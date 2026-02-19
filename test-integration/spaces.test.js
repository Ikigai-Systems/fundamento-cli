import { describe, it, before } from "node:test";
import assert from "node:assert";
import { createTestClient, uniqueName } from "./helpers.js";

describe("spaces", () => {
  let client;

  before(() => {
    client = createTestClient();
  });

  it("lists spaces", async () => {
    const spaces = await client.listSpaces();
    assert(Array.isArray(spaces), "listSpaces should return an array");
    // The seeded org has at least the home space
    assert(spaces.length > 0, "should have at least one space");

    const space = spaces[0];
    assert(typeof space.id === "string", "space should have string id");
    assert(typeof space.name === "string", "space should have string name");
    assert(space.created_at, "space should have created_at");
    assert(space.updated_at, "space should have updated_at");
  });

  it("creates a space", async () => {
    const name = uniqueName("space");
    const space = await client.createSpace({ name, accessMode: "private" });

    assert(typeof space.id === "string", "created space should have string id");
    assert(space.id.length > 0, "id should not be empty");
    assert.strictEqual(space.name, name);
    assert.strictEqual(space.access_mode, "private");
    assert(space.created_at, "should have created_at");
  });

  it("gets a space with document hierarchy", async () => {
    const name = uniqueName("space-get");
    const created = await client.createSpace({ name, accessMode: "public" });

    const space = await client.getSpace(created.id);
    assert.strictEqual(space.name, name);
    assert(typeof space.id === "string", "space should have string id");
    assert(Array.isArray(space.documents), "should have documents array");

    // New space gets a home document automatically
    if (space.documents.length > 0) {
      const doc = space.documents[0];
      assert(typeof doc.npi === "string", "nested doc should have npi field");
      assert(typeof doc.title === "string", "nested doc should have title");
    }
  });
});
