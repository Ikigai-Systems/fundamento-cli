import { test, describe } from "node:test";
import assert from "node:assert";
import { classifyFile } from "../src/import_session.js";

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
