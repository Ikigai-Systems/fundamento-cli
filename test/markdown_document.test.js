import { test } from "node:test";
import assert from "node:assert";
import { prepareMarkdownDocument } from "../src/markdown_document.js";

test("prepareMarkdownDocument keeps frontmatter so the server can apply tags", () => {
  const content = "---\ntitle: Notes\ntags:\n  - project/alpha\n  - status/draft\n---\n# Body\n";

  const { markdown } = prepareMarkdownDocument(content);

  assert.ok(markdown.startsWith("---\n"));
  assert.match(markdown, /- project\/alpha/);
  assert.match(markdown, /- status\/draft/);
  assert.match(markdown, /# Body/);
});

test("prepareMarkdownDocument normalizes CRLF and BOM frontmatter to what the server reads", () => {
  const content = "﻿---\r\ntags:\r\n  - a/b\r\n---\r\n# Body\r\n";

  const { markdown } = prepareMarkdownDocument(content);

  assert.ok(markdown.startsWith("---\ntags:\n  - a/b\n---\n"));
});

test("prepareMarkdownDocument sends plain markdown untouched", () => {
  const { markdown } = prepareMarkdownDocument("# Just a body\n");

  assert.strictEqual(markdown, "# Just a body\n");
});

test("prepareMarkdownDocument resolves title: option > frontmatter > filename > Untitled", () => {
  const withFrontmatter = "---\ntitle: From Frontmatter\n---\nbody";

  assert.strictEqual(prepareMarkdownDocument(withFrontmatter, { title: "From Option", file: "f.md" }).title, "From Option");
  assert.strictEqual(prepareMarkdownDocument(withFrontmatter, { file: "dir/f.md" }).title, "From Frontmatter");
  assert.strictEqual(prepareMarkdownDocument("body", { file: "dir/From File.md" }).title, "From File");
  assert.strictEqual(prepareMarkdownDocument("body").title, "Untitled");
});

test("prepareMarkdownDocument resolves parent: option > frontmatter", () => {
  const content = "---\nparentId: fromFrontmatter\n---\nbody";

  assert.strictEqual(prepareMarkdownDocument(content, { parent: "fromOption" }).parentDocumentId, "fromOption");
  assert.strictEqual(prepareMarkdownDocument(content).parentDocumentId, "fromFrontmatter");
  assert.strictEqual(prepareMarkdownDocument("body").parentDocumentId, undefined);
});
