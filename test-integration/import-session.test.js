import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "crypto";
import { createTestClient, uniqueName } from "./helpers.js";
import { ImportSessionManager } from "../src/import_session.js";

function md5Base64(content) {
  return crypto.createHash("md5").update(content).digest("base64");
}

const FILE_CONTENTS = {
  "README.md": "---\ntitle: Project README\n---\n\n# README\n\nTop-level document.",
  "Guide/getting-started.md": "# Getting Started\n\nFirst steps.",
  "Guide/advanced.md": "# Advanced Usage\n\nDeep dive.",
  "assets/logo.png": "fake-png-data"
};

function buildManifestEntries() {
  return Object.entries(FILE_CONTENTS).map(([relativePath, content]) => {
    const ext = path.extname(relativePath).slice(1);
    const isAttachment = ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf"].includes(ext);
    return {
      relative_path: relativePath,
      checksum: md5Base64(content),
      file_size: Buffer.byteLength(content),
      format: isAttachment ? "image" : "markdown",
      file_type: isAttachment ? "attachment" : "document"
    };
  });
}

describe("batch import (ImportSessionManager)", () => {
  let client;
  let testSpaceId;
  let tmpDir;

  before(async () => {
    client = createTestClient();

    const space = await client.createSpace({
      name: uniqueName("batch-import-tests"),
      accessMode: "private"
    });
    testSpaceId = space.id;

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "funcli-batch-import-"));

    for (const [relativePath, content] of Object.entries(FILE_CONTENTS)) {
      const fullPath = path.join(tmpDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
    }
  });

  after(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("API flow", () => {
    let sessionId;
    let fileEntries;

    it("creates an import session", async () => {
      const session = await client.createImportSession({
        spaceId: testSpaceId,
        sourceFormat: "generic"
      });

      sessionId = session.id;
      assert(sessionId, "session should have an id");
      assert.strictEqual(session.status, "pending");
    });

    it("submits a manifest and receives presigned upload URLs", async () => {
      fileEntries = await client.submitManifest(sessionId, buildManifestEntries());

      assert.strictEqual(fileEntries.length, 4, "should return 4 file entries");
      for (const entry of fileEntries) {
        assert(entry.id, "each entry should have an id");
        assert(entry.direct_upload_url, "each entry should have a direct_upload_url");
        assert(entry.relative_path, "each entry should have a relative_path");
      }
    });

    it("uploads files to presigned URLs and marks them uploaded", async () => {
      const toUpload = fileEntries.filter(e => e.direct_upload_url);

      for (const entry of toUpload) {
        const content = FILE_CONTENTS[entry.relative_path];
        assert(content !== undefined, `should have content for ${entry.relative_path}`);

        const headers = { ...entry.direct_upload_headers };
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = entry.content_type || "application/octet-stream";
        }

        const res = await fetch(entry.direct_upload_url, {
          method: "PUT",
          headers,
          body: content
        });
        assert(res.ok, `upload should succeed for ${entry.relative_path}, got ${res.status}: ${await res.text()}`);

        await client.markFileUploaded(sessionId, entry.id);
      }
    });

    it("triggers processing and completes", async () => {
      await client.triggerProcessing(sessionId);

      // Poll until processing finishes (max 30 seconds)
      let session;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000));
        session = await client.getImportSession(sessionId);
        if (["completed", "partial", "failed"].includes(session.status)) break;
      }

      assert(["completed", "partial"].includes(session.status),
        `session should be completed or partial, got: ${session.status}`);
      assert(session.processed_files > 0, "should have processed files");
    });

    it("session status includes file details", async () => {
      const session = await client.getImportSession(sessionId);
      assert(session.files, "session should include files");
      assert(session.files.length > 0, "should have file entries");

      const completedFiles = session.files.filter(f => f.status === "completed");
      assert(completedFiles.length > 0, "should have completed files");
    });
  });

  describe("ImportSessionManager.start()", () => {
    it("runs the full import pipeline end-to-end", async () => {
      const manager = new ImportSessionManager(client, { concurrency: 2 });
      const sessionFile = path.join(tmpDir, ".test-session.json");

      // Suppress stdout progress output during test
      const origWrite = process.stdout.write;
      const origLog = console.log;
      process.stdout.write = () => true;
      console.log = () => {};

      try {
        await manager.start(testSpaceId, tmpDir, { sessionFile });
      } finally {
        process.stdout.write = origWrite;
        console.log = origLog;
      }

      // Verify session file was created
      assert(fs.existsSync(sessionFile), "session file should be created");
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
      assert(sessionData.session_id, "session file should contain session_id");

      // Verify completion via API
      const session = await client.getImportSession(sessionData.session_id);
      assert(["completed", "partial"].includes(session.status),
        `session should be completed or partial, got: ${session.status}`);
      assert.strictEqual(session.total_files, 4, "should have 4 total files (3 docs + 1 attachment)");
    });
  });
});
