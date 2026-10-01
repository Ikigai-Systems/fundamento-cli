import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { classifyFile, putFile } from "../src/import_session.js";

describe("classifyFile", () => {
  test("recognises the formats the server can convert into documents", () => {
    assert.deepStrictEqual(classifyFile(".md"), { format: "markdown", file_type: "document" });
    assert.deepStrictEqual(classifyFile(".markdown"), { format: "markdown", file_type: "document" });
    assert.deepStrictEqual(classifyFile(".docx"), { format: "docx", file_type: "document" });
    assert.deepStrictEqual(classifyFile(".odt"), { format: "odt", file_type: "document" });
  });

  test("recognises known attachment formats", () => {
    assert.deepStrictEqual(classifyFile(".png"), { format: "image", file_type: "attachment" });
    assert.deepStrictEqual(classifyFile(".pdf"), { format: "pdf", file_type: "attachment" });
    assert.deepStrictEqual(classifyFile(".mp4"), { format: "video", file_type: "attachment" });
  });

  test("sends .doc as an attachment, not a document", () => {
    // Pandoc reads DOCX but not DOC, so a .doc submitted as a document can only ever fail.
    assert.deepStrictEqual(classifyFile(".doc"), { format: "other", file_type: "attachment" });
  });

  test("defaults anything unrecognised to an attachment", () => {
    for (const ext of [".txt", ".csv", ".zip", ".pptx", ".m4a", ".xlsx", ".rtf", ""]) {
      assert.deepStrictEqual(
        classifyFile(ext),
        { format: "other", file_type: "attachment" },
        `expected ${ext || "(no extension)"} to be an attachment`
      );
    }
  });
});

describe("putFile", () => {
  // Serves one scripted response per request: a status code, or "reset" to drop the socket.
  async function withServer(responses, fn) {
    const received = [];
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => {
        received.push(Buffer.concat(chunks).toString());
        const next = responses.shift();
        if (next === "reset") req.socket.destroy();
        else res.writeHead(next).end();
      });
    });
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "funcli-")), "a.txt");
    fs.writeFileSync(file, "hello");
    try {
      return await fn(`http://127.0.0.1:${server.address().port}/upload?sig=1`, file, received);
    } finally {
      server.close();
    }
  }
  const opts = { backoffMs: 1 };

  test("uploads the file body", async () => {
    await withServer([200], async (url, file, received) => {
      await putFile(url, file, {}, opts);
      assert.deepStrictEqual(received, ["hello"]);
    });
  });

  test("retries a dropped connection", async () => {
    await withServer(["reset", 200], async (url, file, received) => {
      await putFile(url, file, {}, opts);
      assert.strictEqual(received.length, 2);
    });
  });

  test("retries a server error", async () => {
    await withServer([503, 200], async (url, file, received) => {
      await putFile(url, file, {}, opts);
      assert.strictEqual(received.length, 2);
    });
  });

  test("gives up after three attempts", async () => {
    await withServer([503, 503, 503, 200], async (url, file, received) => {
      await assert.rejects(putFile(url, file, {}, opts), /HTTP 503/);
      assert.strictEqual(received.length, 3);
    });
  });

  test("does not retry a client error", async () => {
    await withServer([403, 200], async (url, file, received) => {
      await assert.rejects(putFile(url, file, {}, opts), /HTTP 403/);
      assert.strictEqual(received.length, 1);
    });
  });
});
