import { describe, it, before } from "node:test";
import assert from "node:assert";
import { createTestClient, uniqueName } from "./helpers.js";

describe("documents", () => {
  let client;
  let testSpaceId;

  before(async () => {
    client = createTestClient();

    // Create a dedicated space for document tests
    const space = await client.createSpace({
      name: uniqueName("doc-tests"),
      accessMode: "private"
    });
    testSpaceId = space.id;
  });

  it("lists documents in a space", async () => {
    const documents = await client.listDocuments(testSpaceId);
    assert(Array.isArray(documents), "listDocuments should return an array");

    // New space may have a home document
    if (documents.length > 0) {
      const doc = documents[0];
      assert(typeof doc.id === "string", "document should have string id");
      assert(typeof doc.title === "string", "document should have title");
      assert(doc.created_at, "document should have created_at");
    }
  });

  it("creates a document from markdown", async () => {
    const title = uniqueName("doc");
    const markdown = "# Test Document\n\nCreated by integration test.";

    const doc = await client.createDocument(testSpaceId, { title, markdown });

    assert(typeof doc.id === "string", "created doc should have string id");
    assert(doc.id.length > 0, "id should not be empty");
    assert.strictEqual(doc.title, title);
    assert(doc.created_at, "should have created_at");
  });

  it("gets a document as markdown", async () => {
    const title = uniqueName("doc-get-md");
    const markdown = "# Markdown Test\n\nSome content here.";

    const created = await client.createDocument(testSpaceId, { title, markdown });
    const content = await client.getDocument(created.id, "markdown");

    assert(typeof content === "string", "markdown response should be a string");
    assert(content.includes("Markdown Test"), "should contain the heading");
  });

  it("gets a document as json", async () => {
    const title = uniqueName("doc-get-json");
    const markdown = "# JSON Test\n\nContent.";

    const created = await client.createDocument(testSpaceId, { title, markdown });
    const doc = await client.getDocument(created.id, "json");

    assert(typeof doc.id === "string", "should have string id");
    assert.strictEqual(doc.title, title);
    assert(Array.isArray(doc.content), "should have content blocks array");
  });

  it("updates a document", async () => {
    const title = uniqueName("doc-update");
    const created = await client.createDocument(testSpaceId, {
      title,
      markdown: "# Original\n\nOriginal content."
    });

    const updated = await client.updateDocument(created.id, {
      markdown: "# Updated\n\nNew content."
    });

    assert.strictEqual(updated.id, created.id);
    assert.strictEqual(updated.title, title);

    // Verify the content actually changed
    const content = await client.getDocument(created.id, "markdown");
    assert(content.includes("Updated"), "content should be updated");
  });

  it("creates a nested document", async () => {
    const parentTitle = uniqueName("parent");
    const parent = await client.createDocument(testSpaceId, {
      title: parentTitle,
      markdown: "# Parent"
    });

    const childTitle = uniqueName("child");
    const child = await client.createDocument(testSpaceId, {
      title: childTitle,
      markdown: "# Child",
      parentDocumentNpi: parent.id
    });

    assert(typeof child.id === "string", "child should have string id");
    assert.strictEqual(child.title, childTitle);

    // Verify hierarchy via space
    const space = await client.getSpace(testSpaceId);
    const parentInTree = space.documents.find(d => d.npi === parent.id);

    if (parentInTree) {
      assert(
        parentInTree.children && parentInTree.children.some(c => c.npi === child.id),
        "child should appear under parent in hierarchy"
      );
    }
  });
});
