import dotenv from "dotenv";

// quiet: dotenv 17+ logs a line on every load, which would pollute CLI output.
dotenv.config({ quiet: true });

export class Config {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.FUNDAMENTO_BASE_URL || "https://fundamento.cloud";
    this.apiKey = options.apiKey || process.env.FUNDAMENTO_API_KEY;

    if (!this.apiKey) {
      throw new Error("API key is required. Set FUNDAMENTO_API_KEY environment variable or use --token option.");
    }
  }
}
