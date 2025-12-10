import { test } from "node:test";
import assert from "node:assert";
import { DirectoryImporter } from "../src/importer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("DirectoryImporter should track path to NPI mappings", () => {
  const mockClient = {};
  const importer = new DirectoryImporter(mockClient, "space123");

  assert.ok(importer.pathToNpiMap instanceof Map);
  assert.strictEqual(importer.pathToNpiMap.size, 0);
});

test("DirectoryImporter should store space NPI", () => {
  const mockClient = {};
  const importer = new DirectoryImporter(mockClient, "space123");

  assert.strictEqual(importer.spaceNpi, "space123");
});

test("DirectoryImporter should have correct client reference", () => {
  const mockClient = { test: "value" };
  const importer = new DirectoryImporter(mockClient, "space123");

  assert.strictEqual(importer.client, mockClient);
});

test("DirectoryImporter results structure", async () => {
  const mockClient = {
    createDocument: async () => ({ npi: "doc123", title: "Test" })
  };

  const importer = new DirectoryImporter(mockClient, "space123");

  // Create a temporary directory structure for testing
  const testDir = path.join(__dirname, "temp-test-dir");
  fs.mkdirSync(testDir, { recursive: true });

  // Create a test markdown file
  const testFile = path.join(testDir, "test.md");
  fs.writeFileSync(testFile, "# Test\n\nContent here");

  try {
    const results = await importer.importDirectory(testDir);

    assert.ok(results.hasOwnProperty("total"));
    assert.ok(results.hasOwnProperty("successful"));
    assert.ok(results.hasOwnProperty("failed"));
    assert.ok(results.hasOwnProperty("skipped"));
    assert.ok(results.hasOwnProperty("documents"));
    assert.ok(Array.isArray(results.documents));
  } finally {
    // Cleanup
    fs.unlinkSync(testFile);
    fs.rmdirSync(testDir);
  }
});

test("DirectoryImporter should skip non-markdown files", async () => {
  const mockClient = {
    createDocument: async () => ({ npi: "doc123", title: "Test" })
  };

  const importer = new DirectoryImporter(mockClient, "space123");

  // Create a temporary directory structure
  const testDir = path.join(__dirname, "temp-test-skip");
  fs.mkdirSync(testDir, { recursive: true });

  // Create non-markdown files
  const pngFile = path.join(testDir, "image.png");
  const txtFile = path.join(testDir, "notes.txt");
  fs.writeFileSync(pngFile, "fake image data");
  fs.writeFileSync(txtFile, "text content");

  try {
    const results = await importer.importDirectory(testDir);

    assert.strictEqual(results.skipped, 2);
    assert.strictEqual(results.successful, 0);
    assert.strictEqual(results.failed, 0);

    // Verify skipped files are in results
    const skippedPaths = results.documents
      .filter(d => d.type === "skipped")
      .map(d => path.basename(d.path));

    assert.ok(skippedPaths.includes("image.png"));
    assert.ok(skippedPaths.includes("notes.txt"));
  } finally {
    // Cleanup
    fs.unlinkSync(pngFile);
    fs.unlinkSync(txtFile);
    fs.rmdirSync(testDir);
  }
});

test("DirectoryImporter should process markdown files", async () => {
  let createDocumentCalled = false;
  let capturedParams = null;

  const mockClient = {
    createDocument: async (spaceNpi, params) => {
      createDocumentCalled = true;
      capturedParams = { spaceNpi, ...params };
      return { npi: "doc123", title: params.title };
    }
  };

  const importer = new DirectoryImporter(mockClient, "space123");

  // Create a temporary directory structure
  const testDir = path.join(__dirname, "temp-test-md");
  fs.mkdirSync(testDir, { recursive: true });

  // Create a markdown file
  const mdFile = path.join(testDir, "document.md");
  fs.writeFileSync(mdFile, "# Test Document\n\nSome content");

  try {
    const results = await importer.importDirectory(testDir);

    assert.ok(createDocumentCalled);
    assert.strictEqual(capturedParams.spaceNpi, "space123");
    assert.strictEqual(capturedParams.title, "document");
    assert.ok(capturedParams.markdown.includes("# Test Document"));
    assert.strictEqual(results.successful, 1);
  } finally {
    // Cleanup
    fs.unlinkSync(mdFile);
    fs.rmdirSync(testDir);
  }
});
