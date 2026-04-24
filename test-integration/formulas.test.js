import { describe, it, before } from "node:test";
import assert from "node:assert";
import { createTestClient, uniqueName, runCli } from "./helpers.js";

describe("formulas", () => {
  let client;
  let testSpaceId;

  before(async () => {
    client = createTestClient();

    const space = await client.createSpace({
      name: uniqueName("formula-tests"),
      accessMode: "private"
    });
    testSpaceId = space.id;
  });

  describe("client", () => {
    it("evaluates a simple arithmetic formula", async () => {
      const result = await client.evalFormula("1 + 2");
      assert.strictEqual(result.result, 3);
      assert(Array.isArray(result.commands), "should have commands array");
    });

    it("evaluates a string formula", async () => {
      const result = await client.evalFormula('Concatenate("hello", " ", "world")');
      assert.strictEqual(result.result, "hello world");
    });

    it("evaluates a formula with space_id", async () => {
      const result = await client.evalFormula("1 + 1", testSpaceId);
      assert.strictEqual(result.result, 2);
    });

    it("returns error for invalid formula", async () => {
      const result = await client.evalFormula("InvalidFunction((((");
      assert(typeof result.error === "string", "should have error message");
    });
  });

  describe("CLI", () => {
    it("evaluates a formula via argument", async () => {
      const { stdout, exitCode } = await runCli("formulas", "eval", "1 + 2");
      assert.strictEqual(exitCode, 0, `should succeed but got: ${stdout}`);
      assert(stdout.trim().includes("3"), `should output 3, got: ${stdout}`);
    });

    it("evaluates a formula with --json flag", async () => {
      const { stdout, exitCode } = await runCli("formulas", "eval", "1 + 2", "--json");
      assert.strictEqual(exitCode, 0);

      const parsed = JSON.parse(stdout);
      assert.strictEqual(parsed.result, 3);
      assert(Array.isArray(parsed.commands), "JSON should have commands array");
    });

    it("evaluates a formula with --space flag", async () => {
      const { stdout, exitCode } = await runCli(
        "formulas", "eval", "1 + 1", "--space", testSpaceId
      );
      assert.strictEqual(exitCode, 0);
      assert(stdout.trim().includes("2"), `should output 2, got: ${stdout}`);
    });

    it("shows help for formulas command", async () => {
      const { stdout, exitCode } = await runCli("formulas", "--help");
      assert.strictEqual(exitCode, 0);
      assert(stdout.includes("eval"), "should list eval subcommand");
    });
  });
});
