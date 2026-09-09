import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import crypto from "crypto";
import { URL } from "url";

const SESSION_FILE = ".fundamento-session.json";
const MAX_CONCURRENCY = 5;
// The server has the final say on what each uploaded file is — see ImportFile.classify in
// fundamento-cloud. These maps only decide what the CLI reports locally, and are kept
// aligned with it. Note .doc is deliberately absent: Pandoc reads DOCX but not DOC, so a
// .doc sent as a document can only ever fail.
const DOCUMENT_FORMATS_BY_EXT = {
  ".md": "markdown", ".markdown": "markdown", ".docx": "docx", ".odt": "odt"
};

const ATTACHMENT_FORMATS_BY_EXT = {
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
  ".webp": "image", ".svg": "image", ".bmp": "image", ".ico": "image",
  ".tif": "image", ".tiff": "image", ".heic": "image",
  ".pdf": "pdf",
  ".mp4": "video", ".mov": "video", ".avi": "video", ".mkv": "video",
  ".webm": "video", ".m4v": "video", ".wmv": "video", ".flv": "video"
};

// Mirrors ImportFile.classify on the server, which has the final say. Anything we cannot
// convert into a document is an attachment, so an unrecognised extension is stored rather
// than failed.
export function classifyFile(extension) {
  const documentFormat = DOCUMENT_FORMATS_BY_EXT[extension];
  if (documentFormat) return { format: documentFormat, file_type: "document" };

  return { format: ATTACHMENT_FORMATS_BY_EXT[extension] || "other", file_type: "attachment" };
}

export class ImportSessionManager {
  constructor(client, options = {}) {
    this.client = client;
    this.concurrency = options.concurrency || MAX_CONCURRENCY;
    this.ignorePatterns = options.ignore || [];
  }

  async start(spaceId, directory, { format, sessionFile, timeoutMs } = {}) {
    const sessionFilePath = sessionFile || path.join(directory, SESSION_FILE);
    let sessionId = this.#loadSession(sessionFilePath, spaceId);

    if (sessionId) {
      console.log(`Resuming session: ${sessionId}`);
    }

    // Detect Obsidian vault
    const sourceFormat = format ||
      (fs.existsSync(path.join(directory, ".obsidian")) ? "obsidian" : "generic");

    if (sourceFormat === "obsidian" && !format) {
      console.log("Detected Obsidian vault — using Obsidian format");
    }

    // Scan files
    process.stdout.write("Scanning files... ");
    const files = this.#scanDirectory(directory);
    console.log(`${files.length} files found (${this.#formatBytes(files.reduce((s, f) => s + f.size, 0))})`);

    // Create or resume session
    if (!sessionId) {
      const session = await this.client.createImportSession({ spaceId, sourceFormat });
      sessionId = session.id;
      this.#saveSessionId(sessionFilePath, { session_id: sessionId, space_id: spaceId });
      console.log(`Session ID: ${sessionId}`);
    }

    // Submit manifest
    process.stdout.write("Submitting manifest... ");
    const manifest = await this.#buildManifest(files);
    const fileEntries = await this.client.submitManifest(sessionId, manifest);

    const toUpload = fileEntries.filter(f => f.direct_upload_url);
    const alreadyDone = fileEntries.length - toUpload.length;
    console.log(`${toUpload.length} files to upload (${alreadyDone} already uploaded)`);

    if (toUpload.length > 0) {
      await this.#uploadFiles(toUpload, files, sessionId);
    }

    // Trigger processing
    await this.client.triggerProcessing(sessionId);
    console.log("\nAll files uploaded. Processing started.");
    console.log(`Session ID: ${sessionId}  (run \`funcli import cancel ${sessionId}\` to cancel)`);

    // Poll for completion
    await this.#pollProgress(sessionId, { timeoutMs });
  }

  async status(sessionId) {
    const session = await this.client.getImportSession(sessionId);
    console.log(`\nSession: ${sessionId}`);
    console.log(`Status: ${session.status}`);
    console.log(`Progress: ${session.processed_files} / ${session.total_files} processed`);
    if (session.failed_files > 0) {
      console.log(`Failed: ${session.failed_files}`);
    }
  }

  async cancel(sessionId) {
    await this.client.cancelImportSession(sessionId);
    console.log(`Session ${sessionId} cancelled.`);
  }

  async retry(sessionId) {
    await this.client.retryImportSession(sessionId);
    console.log(`Retrying failed files in session ${sessionId}...`);
    await this.#pollProgress(sessionId);
  }

  async log(sessionId, { failedOnly = false, json = false } = {}) {
    const session = await this.client.getImportSession(sessionId);
    let files = session.files || [];
    if (failedOnly) files = files.filter(f => f.status === "failed");

    if (json) {
      console.log(JSON.stringify(files, null, 2));
      return;
    }

    console.log(`\nImport Log — ${sessionId}\n${"─".repeat(60)}`);
    for (const f of files) {
      const icon = { completed: "✓", failed: "✗", skipped: "⊘" }[f.status] || "⏳";
      const detail = f.document_id ? `→ ${f.document_id}` : (f.error_message || "");
      console.log(`  ${icon} ${f.relative_path.padEnd(50)} ${detail}`);
    }
  }

  // ── Private ────────────────────────────────────────────────────────

  #scanDirectory(dir, prefix = "") {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (this.#shouldIgnore(entry.name)) continue;

      if (entry.isDirectory()) {
        results.push(...this.#scanDirectory(fullPath, relativePath));
      } else if (entry.isFile()) {
        // Everything that survives #shouldIgnore is sent. This used to keep only known
        // extensions, which silently dropped .csv, .txt, .xlsx, .pptx and .m4a from the
        // import — the user was never told their files had not arrived.
        const stat = fs.statSync(fullPath);
        results.push({
          fullPath, relativePath, size: stat.size,
          ext: path.extname(entry.name).toLowerCase()
        });
      }
    }
    return results;
  }

  async #buildManifest(files) {
    return Promise.all(files.map(async (f) => {
      const checksum = await this.#md5Base64(f.fullPath);
      return {
        relative_path: f.relativePath,
        checksum,
        file_size: f.size,
        ...classifyFile(f.ext)
      };
    }));
  }

  async #uploadFiles(toUpload, allFiles, sessionId) {
    let done = 0;
    const total = toUpload.length;
    const queue = [...toUpload];

    const worker = async () => {
      while (queue.length > 0) {
        const entry = queue.shift();
        if (!entry) break;
        const local = allFiles.find(f => f.relativePath === entry.relative_path);
        if (!local) continue;

        await this.#uploadFile(entry, local.fullPath, sessionId);
        done++;
        this.#printProgress(done, total);
      }
    };

    const workers = Array.from({ length: this.concurrency }, worker);
    await Promise.all(workers).catch(e => {
      process.stdout.write("\n");
      throw e;
    });
    process.stdout.write("\n");
  }

  async #uploadFile(entry, filePath, sessionId) {
    const stat = fs.statSync(filePath);
    const status = await new Promise((resolve, reject) => {
      const parsed = new URL(entry.direct_upload_url);
      const transport = parsed.protocol === "https:" ? https : http;
      const headers = {
        "Content-Type": entry.content_type || "application/octet-stream",
        "Content-Length": String(stat.size),
        ...entry.direct_upload_headers
      };
      const req = transport.request(
        { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: "PUT", headers },
        (res) => { res.resume(); resolve(res.statusCode); }
      );
      req.on("error", reject);
      fs.createReadStream(filePath).pipe(req);
    });
    if (status < 200 || status >= 300) {
      throw new Error(`Upload failed for ${entry.relative_path}: HTTP ${status}`);
    }
    await this.client.markFileUploaded(sessionId, entry.id);
  }

  async #pollProgress(sessionId, { timeoutMs = 30 * 60 * 1000 } = {}) {
    process.stdout.write("\nProcessing ");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const session = await this.client.getImportSession(sessionId);
      const pct = session.total_files > 0
        ? Math.round((session.processed_files / session.total_files) * 100)
        : 0;
      process.stdout.write(`\rProcessing  ${this.#progressBar(pct)}  ${pct}%   ${session.processed_files} / ${session.total_files}`);

      if (["completed", "partial", "failed"].includes(session.status)) {
        console.log(`\n\n✓ Import ${session.status}  (${session.failed_files} failed, ${session.processed_files} imported)`);
        return;
      }
    }

    throw new Error(`Import session ${sessionId} did not complete within ${Math.round(timeoutMs / 60000)} minutes`);
  }

  #progressBar(pct, width = 20) {
    const filled = Math.min(width, Math.round(width * pct / 100));
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
  }

  #printProgress(done, total) {
    const pct = Math.round(done / total * 100);
    process.stdout.write(`\rUploading  ${this.#progressBar(pct)}  ${pct}%   ${done} / ${total}`);
  }

  #shouldIgnore(name) {
    for (const pattern of this.ignorePatterns) {
      if (new RegExp(pattern.replace("*", ".*")).test(name)) return true;
    }
    return name.startsWith(".");
  }

  async #md5Base64(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(filePath);
      stream.on("data", d => hash.update(d));
      stream.on("end", () => resolve(hash.digest("base64")));
      stream.on("error", reject);
    });
  }

  #formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  #loadSession(sessionFilePath, expectedSpaceId) {
    if (!fs.existsSync(sessionFilePath)) return null;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(sessionFilePath, "utf8"));
    } catch { return null; }

    if (!data.session_id) return null;

    if (data.space_id && data.space_id !== expectedSpaceId) {
      console.error(
        `Error: session file records space ${data.space_id} but you specified ${expectedSpaceId}.\n` +
        `Run \`funcli import reset ${path.dirname(sessionFilePath)}\` to start fresh, or omit the space ID to resume.`
      );
      process.exit(1);
    }

    return data.session_id;
  }

  #saveSessionId(sessionFilePath, data) {
    fs.writeFileSync(sessionFilePath, JSON.stringify(data, null, 2));
  }
}
