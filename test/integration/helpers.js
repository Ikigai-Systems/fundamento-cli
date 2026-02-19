import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Config } from "../../src/config.js";
import { FundamentoClient } from "../../src/client.js";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Load .env.test if it exists
const envTestPath = path.join(PROJECT_ROOT, ".env.test");
if (fs.existsSync(envTestPath)) {
  const envContent = fs.readFileSync(envTestPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

const BASE_URL = process.env.FUNDAMENTO_TEST_URL || "http://localhost:3333";
const API_KEY = process.env.FUNDAMENTO_TEST_API_KEY;

export function getTestConfig() {
  if (!API_KEY) {
    throw new Error(
      "FUNDAMENTO_TEST_API_KEY is not set. Run 'npm run test:integration:up' first."
    );
  }
  return { baseUrl: BASE_URL, apiKey: API_KEY };
}

export function createTestClient() {
  const { baseUrl, apiKey } = getTestConfig();
  const config = new Config({ baseUrl, apiKey });
  return new FundamentoClient(config);
}

export function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function runCli(...args) {
  const cliBin = path.join(PROJECT_ROOT, "bin/funcli.js");
  const { baseUrl, apiKey } = getTestConfig();

  const fullArgs = [
    cliBin,
    "--token", apiKey,
    "--base-url", baseUrl,
    ...args
  ];

  try {
    const { stdout, stderr } = await execFileAsync("node", fullArgs, {
      cwd: PROJECT_ROOT,
      timeout: 30000
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.code ?? 1
    };
  }
}
