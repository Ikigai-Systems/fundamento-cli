import { Command } from "commander";
import chalk from "chalk";
import { Config } from "./config.js";
import { FundamentoClient } from "./client.js";

const program = new Command();

program
  .name("funcli")
  .description("CLI client for Fundamento Cloud")
  .version("0.1.0")
  .option("-t, --token <token>", "API token (overrides FUNDAMENTO_API_KEY)")
  .option("-u, --base-url <url>", "Base URL (default: https://fundamento.cloud)");

const spacesCommand = program
  .command("spaces")
  .description("Manage spaces");

spacesCommand
  .command("list")
  .description("List all available spaces")
  .action(async () => {
    try {
      const config = new Config({
        apiKey: program.opts().token,
        baseUrl: program.opts().baseUrl
      });
      const client = new FundamentoClient(config);
      const spaces = await client.listSpaces();

      console.log(chalk.bold("\nAvailable Spaces:\n"));

      for (const space of spaces) {
        console.log(chalk.cyan(`${space.name}`) + chalk.gray(` (${space.npi})`));
        if (space.documents && space.documents.length > 0) {
          console.log(chalk.gray(`  └─ ${space.documents.length} documents`));
        }
      }

      console.log();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

spacesCommand
  .command("get <npi>")
  .description("Get details of a specific space")
  .option("-j, --json", "Output as JSON")
  .action(async (npi, options) => {
    try {
      const config = new Config({
        apiKey: program.opts().token,
        baseUrl: program.opts().baseUrl
      });
      const client = new FundamentoClient(config);
      const space = await client.getSpace(npi);

      if (options.json) {
        console.log(JSON.stringify(space, null, 2));
      } else {
        console.log(chalk.bold(`\n${space.name}`) + chalk.gray(` (${space.npi})`));
        console.log();

        if (space.documents && space.documents.length > 0) {
          console.log(chalk.bold("Documents:"));
          printDocumentTree(space.documents, 0);
        } else {
          console.log(chalk.gray("No documents"));
        }

        console.log();
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

const documentsCommand = program
  .command("documents")
  .description("Manage documents");

documentsCommand
  .command("list <space-npi>")
  .description("List documents in a space")
  .option("-j, --json", "Output as JSON")
  .action(async (spaceNpi, options) => {
    try {
      const config = new Config({
        apiKey: program.opts().token,
        baseUrl: program.opts().baseUrl
      });
      const client = new FundamentoClient(config);
      const documents = await client.listDocuments(spaceNpi);

      if (options.json) {
        console.log(JSON.stringify(documents, null, 2));
      } else {
        console.log(chalk.bold("\nDocuments:\n"));

        for (const doc of documents) {
          console.log(chalk.cyan(doc.title) + chalk.gray(` (${doc.npi})`));
        }

        console.log();
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

documentsCommand
  .command("get <npi>")
  .description("Get a document")
  .option("-f, --format <format>", "Output format (markdown|json)", "markdown")
  .action(async (npi, options) => {
    try {
      const config = new Config({
        apiKey: program.opts().token,
        baseUrl: program.opts().baseUrl
      });
      const client = new FundamentoClient(config);
      const document = await client.getDocument(npi, options.format);

      if (options.format === "json") {
        console.log(JSON.stringify(document, null, 2));
      } else {
        console.log(document);
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

function printDocumentTree(documents, level) {
  const indent = "  ".repeat(level);

  for (const doc of documents) {
    console.log(indent + chalk.cyan(doc.title) + chalk.gray(` (${doc.npi})`));

    if (doc.children && doc.children.length > 0) {
      printDocumentTree(doc.children, level + 1);
    }
  }
}

program.parse();
