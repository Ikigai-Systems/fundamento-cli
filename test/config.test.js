import { test } from "node:test";
import assert from "node:assert";
import { Config } from "../src/config.js";

test("Config should throw error when API key is missing", () => {
  const originalKey = process.env.FUNDAMENTO_API_KEY;
  delete process.env.FUNDAMENTO_API_KEY;

  assert.throws(() => {
    new Config({});
  }, {
    message: "API key is required. Set FUNDAMENTO_API_KEY environment variable or use --token option."
  });

  if (originalKey) {
    process.env.FUNDAMENTO_API_KEY = originalKey;
  }
});

test("Config should use provided API key", () => {
  const config = new Config({ apiKey: "test-key" });
  assert.strictEqual(config.apiKey, "test-key");
});

test("Config should use default base URL", () => {
  const config = new Config({ apiKey: "test-key" });
  assert.strictEqual(config.baseUrl, "https://fundamento.cloud");
});

test("Config should use provided base URL", () => {
  const config = new Config({
    apiKey: "test-key",
    baseUrl: "http://localhost:3000"
  });
  assert.strictEqual(config.baseUrl, "http://localhost:3000");
});
