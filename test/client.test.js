import { test } from "node:test";
import assert from "node:assert";
import { FundamentoClient } from "../src/client.js";
import { Config } from "../src/config.js";

test("FundamentoClient should be instantiated with config", () => {
  const config = new Config({ apiKey: "test-key" });
  const client = new FundamentoClient(config);

  assert.ok(client);
  assert.strictEqual(client.config.apiKey, "test-key");
});

test("FundamentoClient should set Authorization header", () => {
  const config = new Config({ apiKey: "test-key" });
  const client = new FundamentoClient(config);

  assert.strictEqual(
    client.axios.defaults.headers["Authorization"],
    "Bearer test-key"
  );
});

test("FundamentoClient should set base URL", () => {
  const config = new Config({
    apiKey: "test-key",
    baseUrl: "http://localhost:3000"
  });
  const client = new FundamentoClient(config);

  assert.strictEqual(client.axios.defaults.baseURL, "http://localhost:3000");
});

test("FundamentoClient createDocument should format request correctly", () => {
  const config = new Config({ apiKey: "test-key" });
  const client = new FundamentoClient(config);

  // Mock axios post
  const originalPost = client.axios.post;
  let capturedUrl, capturedData;

  client.axios.post = async (url, data) => {
    capturedUrl = url;
    capturedData = data;
    return { data: { npi: "test123", title: "Test" } };
  };

  // Call createDocument
  client.createDocument("space123", {
    title: "Test Document",
    markdown: "# Hello",
    parentDocumentNpi: "parent123"
  });

  // Verify the request format
  assert.strictEqual(capturedUrl, "/api/v1/documents");
  assert.deepStrictEqual(capturedData, {
    document: {
      title: "Test Document",
      markdown: "# Hello",
      parent_document_npi: "parent123"
    }
  });

  // Restore original post
  client.axios.post = originalPost;
});

test("FundamentoClient createSpace should format request correctly", () => {
  const config = new Config({ apiKey: "test-key" });
  const client = new FundamentoClient(config);

  // Mock axios post
  const originalPost = client.axios.post;
  let capturedUrl, capturedData;

  client.axios.post = async (url, data) => {
    capturedUrl = url;
    capturedData = data;
    return { data: { npi: "space123", name: "Test Space", access_mode: "public" } };
  };

  // Call createSpace
  client.createSpace({
    name: "Test Space",
    accessMode: "public"
  });

  // Verify the request format
  assert.strictEqual(capturedUrl, "/api/v1/spaces");
  assert.deepStrictEqual(capturedData, {
    space: {
      name: "Test Space",
      access_mode: "public"
    }
  });

  // Restore original post
  client.axios.post = originalPost;
});

test("FundamentoClient updateDocument should format request correctly", () => {
  const config = new Config({ apiKey: "test-key" });
  const client = new FundamentoClient(config);

  // Mock axios patch
  const originalPatch = client.axios.patch;
  let capturedUrl, capturedData;

  client.axios.patch = async (url, data) => {
    capturedUrl = url;
    capturedData = data;
    return { data: { npi: "doc123", title: "Updated Document" } };
  };

  // Call updateDocument
  client.updateDocument("doc123", {
    markdown: "# Updated Content"
  });

  // Verify the request format
  assert.strictEqual(capturedUrl, "/api/v1/documents/doc123");
  assert.deepStrictEqual(capturedData, {
    document: {
      markdown: "# Updated Content"
    }
  });

  // Restore original patch
  client.axios.patch = originalPatch;
});
