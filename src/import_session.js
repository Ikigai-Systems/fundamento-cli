import fs from "fs"
import path from "path"
import crypto from "crypto"

const SESSION_FILE = ".fundamento-session.json"
const MAX_CONCURRENCY = 5
const DOCUMENT_EXTS = new Set([".md", ".docx", ".odt", ".doc"])
const ATTACHMENT_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
                                   ".pdf", ".mp4", ".mov", ".avi"])

export class ImportSessionManager {
  constructor(client, options = {}) {
    this.client = client
    this.concurrency = options.concurrency || MAX_CONCURRENCY
    this.ignorePatterns = options.ignore || []
  }

  async start(spaceId, directory, { format, sessionFile } = {}) {
    const sessionFilePath = sessionFile || path.join(directory, SESSION_FILE)
    let sessionId = this.#loadSessionId(sessionFilePath)

    if (sessionId) {
      console.log(`Resuming session: ${sessionId}`)
    }

    // Detect Obsidian vault
    const sourceFormat = format ||
      (fs.existsSync(path.join(directory, ".obsidian")) ? "obsidian" : "generic")

    if (sourceFormat === "obsidian" && !format) {
      console.log("Detected Obsidian vault — using Obsidian format")
    }

    // Scan files
    process.stdout.write("Scanning files... ")
    const files = this.#scanDirectory(directory)
    console.log(`${files.length} files found (${this.#formatBytes(files.reduce((s, f) => s + f.size, 0))})`)

    // Create or resume session
    if (!sessionId) {
      const session = await this.client.createImportSession({ spaceId, sourceFormat })
      sessionId = session.id
      this.#saveSessionId(sessionFilePath, { session_id: sessionId, space_id: spaceId })
      console.log(`Session ID: ${sessionId}`)
    }

    // Submit manifest
    process.stdout.write("Submitting manifest... ")
    const manifest = await this.#buildManifest(files)
    const fileEntries = await this.client.submitManifest(sessionId, manifest)

    const toUpload = fileEntries.filter(f => f.direct_upload_url)
    const alreadyDone = fileEntries.length - toUpload.length
    console.log(`${toUpload.length} files to upload (${alreadyDone} already uploaded)`)

    if (toUpload.length > 0) {
      await this.#uploadFiles(toUpload, files, sessionId)
    }

    // Trigger processing
    await this.client.triggerProcessing(sessionId)
    console.log("\nAll files uploaded. Processing started.")
    console.log(`Session ID: ${sessionId}  (run \`funcli import cancel ${sessionId}\` to cancel)`)

    // Poll for completion
    await this.#pollProgress(sessionId)
  }

  async status(sessionId) {
    const session = await this.client.getImportSession(sessionId)
    console.log(`\nSession: ${sessionId}`)
    console.log(`Status: ${session.status}`)
    console.log(`Progress: ${session.processed_files} / ${session.total_files} processed`)
    if (session.failed_files > 0) {
      console.log(`Failed: ${session.failed_files}`)
    }
  }

  async cancel(sessionId) {
    await this.client.cancelImportSession(sessionId)
    console.log(`Session ${sessionId} cancelled.`)
  }

  async retry(sessionId) {
    await this.client.retryImportSession(sessionId)
    console.log(`Retrying failed files in session ${sessionId}...`)
    await this.#pollProgress(sessionId)
  }

  async log(sessionId, { failedOnly = false, json = false } = {}) {
    const session = await this.client.getImportSession(sessionId)
    let files = session.files || []
    if (failedOnly) files = files.filter(f => f.status === "failed")

    if (json) {
      console.log(JSON.stringify(files, null, 2))
      return
    }

    console.log(`\nImport Log — ${sessionId}\n${"─".repeat(60)}`)
    for (const f of files) {
      const icon = { completed: "✓", failed: "✗", skipped: "⊘" }[f.status] || "⏳"
      const detail = f.document_id ? `→ ${f.document_id}` : (f.error_message || "")
      console.log(`  ${icon} ${f.relative_path.padEnd(50)} ${detail}`)
    }
  }

  // ── Private ────────────────────────────────────────────────────────

  #scanDirectory(dir, prefix = "") {
    const results = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (this.#shouldIgnore(entry.name)) continue

      if (entry.isDirectory()) {
        results.push(...this.#scanDirectory(fullPath, relativePath))
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (DOCUMENT_EXTS.has(ext) || ATTACHMENT_EXTS.has(ext)) {
          const stat = fs.statSync(fullPath)
          results.push({ fullPath, relativePath, size: stat.size, ext })
        }
      }
    }
    return results
  }

  async #buildManifest(files) {
    return Promise.all(files.map(async (f) => {
      const checksum = await this.#md5Base64(f.fullPath)
      const ext = f.ext.slice(1)
      return {
        relative_path: f.relativePath,
        checksum,
        file_size: f.size,
        format: this.#detectFormat(ext),
        file_type: ATTACHMENT_EXTS.has(f.ext) ? "attachment" : "document"
      }
    }))
  }

  async #uploadFiles(toUpload, allFiles, sessionId) {
    let done = 0
    const total = toUpload.length
    const queue = [...toUpload]

    const worker = async () => {
      while (queue.length > 0) {
        const entry = queue.shift()
        if (!entry) break
        const local = allFiles.find(f => f.relativePath === entry.relative_path)
        if (!local) continue

        await this.#uploadFile(entry, local.fullPath, sessionId)
        done++
        this.#printProgress(done, total)
      }
    }

    const workers = Array.from({ length: this.concurrency }, worker)
    await Promise.all(workers)
    process.stdout.write("\n")
  }

  async #uploadFile(entry, filePath, sessionId) {
    const fileBuffer = fs.readFileSync(filePath)
    const uploadRes = await fetch(entry.direct_upload_url, {
      method: "PUT",
      headers: { "Content-Type": entry.content_type || "application/octet-stream" },
      body: fileBuffer
    })
    if (!uploadRes.ok) {
      throw new Error(`Upload failed for ${entry.relative_path}: HTTP ${uploadRes.status}`)
    }
    await this.client.markFileUploaded(sessionId, entry.id)
  }

  async #pollProgress(sessionId) {
    process.stdout.write("\nProcessing ")
    while (true) {
      await new Promise(r => setTimeout(r, 2000))
      const session = await this.client.getImportSession(sessionId)
      const pct = session.total_files > 0
        ? Math.round((session.processed_files / session.total_files) * 100)
        : 0
      process.stdout.write(`\rProcessing  ${this.#progressBar(pct)}  ${pct}%   ${session.processed_files} / ${session.total_files}`)

      if (["completed", "partial", "failed"].includes(session.status)) {
        console.log(`\n\n✓ Import ${session.status}  (${session.failed_files} failed, ${session.processed_files} imported)`)
        break
      }
    }
  }

  #progressBar(pct, width = 20) {
    const filled = Math.round(width * pct / 100)
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]"
  }

  #printProgress(done, total) {
    const pct = Math.round(done / total * 100)
    process.stdout.write(`\rUploading  ${this.#progressBar(pct)}  ${pct}%   ${done} / ${total}`)
  }

  #shouldIgnore(name) {
    for (const pattern of this.ignorePatterns) {
      if (new RegExp(pattern.replace("*", ".*")).test(name)) return true
    }
    return name.startsWith(".")
  }

  async #md5Base64(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("md5")
      const stream = fs.createReadStream(filePath)
      stream.on("data", d => hash.update(d))
      stream.on("end", () => resolve(hash.digest("base64")))
      stream.on("error", reject)
    })
  }

  #detectFormat(ext) {
    const map = { md: "markdown", docx: "docx", odt: "odt", doc: "doc",
                  png: "image", jpg: "image", jpeg: "image", gif: "image",
                  webp: "image", svg: "image", pdf: "pdf",
                  mp4: "video", mov: "video", avi: "video" }
    return map[ext] || "other"
  }

  #formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  #loadSessionId(sessionFilePath) {
    if (!fs.existsSync(sessionFilePath)) return null
    try {
      return JSON.parse(fs.readFileSync(sessionFilePath, "utf8")).session_id
    } catch { return null }
  }

  #saveSessionId(sessionFilePath, data) {
    fs.writeFileSync(sessionFilePath, JSON.stringify(data, null, 2))
  }
}
