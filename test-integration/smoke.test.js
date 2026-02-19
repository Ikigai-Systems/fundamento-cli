import { describe, it } from "node:test";
import assert from "node:assert";
import { runCli, uniqueName } from "./helpers.js";

describe("CLI smoke tests", () => {
  it("shows help", async () => {
    const { stdout, exitCode } = await runCli("--help");
    assert.strictEqual(exitCode, 0);
    assert(stdout.includes("funcli"), "should show program name");
    assert(stdout.includes("spaces"), "should list spaces command");
    assert(stdout.includes("documents"), "should list documents command");
  });

  it("shows version", async () => {
    const { stdout, exitCode } = await runCli("--version");
    assert.strictEqual(exitCode, 0);
    assert(/\d+\.\d+\.\d+/.test(stdout.trim()), "should output a version number");
  });

  it("lists spaces via CLI", async () => {
    const { stdout, exitCode } = await runCli("spaces", "list");
    assert.strictEqual(exitCode, 0);
    assert(stdout.includes("Available Spaces"), "should show header");
  });

  it("creates and gets a space via CLI", async () => {
    const name = uniqueName("cli-smoke");

    const createResult = await runCli("spaces", "create", name);
    assert.strictEqual(createResult.exitCode, 0, `create failed: ${createResult.stderr}`);
    assert(createResult.stdout.includes("Space created successfully"), "should confirm creation");
    assert(createResult.stdout.includes(name), "should show space name");

    // Extract the ID from output - format is "Name (id)"
    const idMatch = createResult.stdout.match(/\(([a-zA-Z0-9_-]+)\)/);
    assert(idMatch, "should show space id in output");
    const spaceId = idMatch[1];

    const getResult = await runCli("spaces", "get", spaceId);
    assert.strictEqual(getResult.exitCode, 0, `get failed: ${getResult.stderr}`);
    assert(getResult.stdout.includes(name), "should show space name in details");
  });

  it("creates and retrieves a document via CLI", async () => {
    const spaceName = uniqueName("cli-doc-smoke");
    const createSpace = await runCli("spaces", "create", spaceName);
    const spaceIdMatch = createSpace.stdout.match(/\(([a-zA-Z0-9_-]+)\)/);
    const spaceId = spaceIdMatch[1];

    // List documents
    const listResult = await runCli("documents", "list", spaceId);
    assert.strictEqual(listResult.exitCode, 0, `list failed: ${listResult.stderr}`);
    assert(listResult.stdout.includes("Documents"), "should show header");
  });

  it("fails gracefully with invalid token", async () => {
    const result = await runCli(
      "--token", "invalid-token",
      "spaces", "list"
    );
    assert.notStrictEqual(result.exitCode, 0, "should fail with invalid token");
  });

  it("spaces get --json outputs valid JSON", async () => {
    // First get a space id
    const name = uniqueName("cli-json");
    const createResult = await runCli("spaces", "create", name);
    const idMatch = createResult.stdout.match(/\(([a-zA-Z0-9_-]+)\)/);
    const spaceId = idMatch[1];

    const { stdout, exitCode } = await runCli("spaces", "get", spaceId, "--json");
    assert.strictEqual(exitCode, 0);

    const parsed = JSON.parse(stdout);
    assert.strictEqual(parsed.name, name);
    assert(typeof parsed.id === "string", "JSON should have string id");
    assert(Array.isArray(parsed.documents), "JSON should have documents array");
  });
});
