import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createTestClient, uniqueName } from "./helpers.js";
import { DirectoryImporter } from "../../src/importer.js";

describe("directory import", () => {
  let client;
  let testSpaceId;
  let tmpDir;

  before(async () => {
    client = createTestClient();

    const space = await client.createSpace({
      name: uniqueName("import-tests"),
      accessMode: "private"
    });
    testSpaceId = space.id;

    // Create a temp directory structure:
    //   tmpDir/
    //     README.md
    //     Guide/
    //       getting-started.md
    //       advanced.md
    //     image.png  (should be skipped)
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "funcli-import-"));

    fs.writeFileSync(
      path.join(tmpDir, "README.md"),
      "---\ntitle: Project README\n---\n\n# README\n\nTop-level document."
    );

    fs.mkdirSync(path.join(tmpDir, "Guide"));
    fs.writeFileSync(
      path.join(tmpDir, "Guide", "getting-started.md"),
      "# Getting Started\n\nFirst steps."
    );
    fs.writeFileSync(
      path.join(tmpDir, "Guide", "advanced.md"),
      "# Advanced Usage\n\nDeep dive."
    );

    fs.writeFileSync(path.join(tmpDir, "image.png"), "not-a-real-image");
  });

  after(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("imports directory maintaining hierarchy", async () => {
    const importer = new DirectoryImporter(client, testSpaceId);
    const results = await importer.importDirectory(tmpDir);

    assert.strictEqual(results.failed, 0, `failures: ${JSON.stringify(results.documents.filter(d => d.error))}`);
    assert.strictEqual(results.skipped, 1, "should skip image.png");
    assert.strictEqual(results.successful, 4, "should create 4 documents: README, Guide folder, getting-started, advanced");

    // Verify the Guide directory document was created and has an NPI
    const guideDoc = results.documents.find(d => d.title === "Guide" && d.type === "directory");
    assert(guideDoc, "should have a Guide directory document");
    assert(guideDoc.npi, "Guide document should have an npi from API response");

    // Verify child documents reference the Guide as parent
    const children = results.documents.filter(d => d.parent === guideDoc.npi);
    assert.strictEqual(children.length, 2, "Guide should have 2 child documents");

    const childTitles = children.map(c => c.title).sort();
    assert.deepStrictEqual(childTitles, ["advanced", "getting-started"]);
  });

  it("hierarchy is reflected in the space", async () => {
    // The previous test created the hierarchy - verify it via the API
    const space = await client.getSpace(testSpaceId);
    const guideInTree = space.documents.find(d => d.title === "Guide");

    assert(guideInTree, "Guide should appear in space document tree");
    assert(guideInTree.children, "Guide should have children in tree");
    assert.strictEqual(guideInTree.children.length, 2, "Guide should have 2 children in tree");
  });

  it("frontmatter title is used", async () => {
    const importer = new DirectoryImporter(client, testSpaceId);
    const results = await importer.importDirectory(tmpDir);

    const readme = results.documents.find(d => d.type === "file" && d.title === "Project README");
    assert(readme, "should use title from frontmatter, not filename");
  });
});
