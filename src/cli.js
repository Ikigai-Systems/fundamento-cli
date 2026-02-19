import { Command } from "commander";
import chalk from "chalk";
import { Config } from "./config.js";
import { FundamentoClient } from "./client.js";
import { DirectoryImporter } from "./importer.js";
import matter from "gray-matter";
import fs from "fs";
import path from "path";

const program = new Command();

// Helper function to wrap action handlers with client initialization and error handling
function withClient(handler) {
  return async (...args) => {
    try {
      const config = new Config({
        apiKey: program.opts().token,
        baseUrl: program.opts().baseUrl
      });
      const client = new FundamentoClient(config);
      await handler(client, ...args);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  };
}

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
  .action(withClient(async (client) => {
    const spaces = await client.listSpaces();

    console.log(chalk.bold("\nAvailable Spaces:\n"));

    for (const space of spaces) {
      console.log(chalk.cyan(`${space.name}`) + chalk.gray(` (${space.id})`));
      if (space.documents && space.documents.length > 0) {
        console.log(chalk.gray(`  └─ ${space.documents.length} documents`));
      }
    }

    console.log();
  }));

spacesCommand
  .command("get <id>")
  .description("Get details of a specific space")
  .option("-j, --json", "Output as JSON")
  .action(withClient(async (client, id, options) => {
    const space = await client.getSpace(id);

    if (options.json) {
      console.log(JSON.stringify(space, null, 2));
    } else {
      console.log(chalk.bold(`\n${space.name}`) + chalk.gray(` (${space.id})`));
      console.log();

      if (space.documents && space.documents.length > 0) {
        console.log(chalk.bold("Documents:"));
        printDocumentTree(space.documents, 0);
      } else {
        console.log(chalk.gray("No documents"));
      }

      console.log();
    }
  }));

spacesCommand
  .command("create <name>")
  .description("Create a new space")
  .option("-a, --access-mode <mode>", "Access mode: public, restricted, or private (default: public)", "public")
  .action(withClient(async (client, name, options) => {
    // Validate access mode
    const validModes = ["public", "restricted", "private"];
    const accessMode = options.accessMode.toLowerCase();
    if (!validModes.includes(accessMode)) {
      console.error(chalk.red("Error:"), `Invalid access mode. Must be one of: ${validModes.join(", ")}`);
      process.exit(1);
    }

    const space = await client.createSpace({ name, accessMode });

    console.log(chalk.green("✓") + " Space created successfully!");
    console.log(chalk.bold(space.name) + chalk.gray(` (${space.id})`));
    console.log(chalk.gray(`Access mode: ${space.access_mode}`));
  }));

const documentsCommand = program
  .command("documents")
  .description("Manage documents");

documentsCommand
  .command("list <space-id>")
  .description("List documents in a space")
  .option("-j, --json", "Output as JSON")
  .action(withClient(async (client, spaceId, options) => {
    const documents = await client.listDocuments(spaceId);

    if (options.json) {
      console.log(JSON.stringify(documents, null, 2));
    } else {
      console.log(chalk.bold("\nDocuments:\n"));

      for (const doc of documents) {
        console.log(chalk.cyan(doc.title) + chalk.gray(` (${doc.id})`));
      }

      console.log();
    }
  }));

documentsCommand
  .command("get <id>")
  .description("Get a document")
  .option("-f, --format <format>", "Output format (markdown|json)", "markdown")
  .action(withClient(async (client, id, options) => {
    const document = await client.getDocument(id, options.format);

    if (options.format === "json") {
      console.log(JSON.stringify(document, null, 2));
    } else {
      console.log(document);
    }
  }));

documentsCommand
  .command("create <space-id>")
  .description("Create a new document from markdown file, Word/OpenOffice file, or stdin")
  .argument("[file]", "File to upload (markdown, .docx, .doc, .odt, etc.) or omit to read markdown from stdin")
  .option("-p, --parent <id>", "Parent document ID (for nested documents)")
  .option("-t, --title <title>", "Document title (overrides frontmatter)")
  .action(withClient(async (client, spaceId, file, options) => {
    // Determine if this is a file upload (Word/OpenOffice) or markdown content
    const fileUploadExtensions = [".docx", ".doc", ".odt", ".rtf", ".txt"];
    const isFileUpload = file && fileUploadExtensions.some(ext => file.toLowerCase().endsWith(ext));

    if (isFileUpload) {
      // File upload path - send file directly
      if (!fs.existsSync(file)) {
        console.error(chalk.red("Error:"), `File not found: ${file}`);
        process.exit(1);
      }

      // Determine title (priority: CLI arg > filename)
      let title = options.title;
      if (!title) {
        title = path.basename(file, path.extname(file));
      }

      // Create document from file
      const document = await client.createDocument(spaceId, {
        title,
        parentDocumentId: options.parent,
        file
      });

      console.log(chalk.green("✓") + " Document created successfully from file!");
      console.log(chalk.bold(document.title) + chalk.gray(` (${document.id})`));
    } else {
      // Markdown path - parse frontmatter
      let content;
      if (file) {
        content = fs.readFileSync(file, "utf8");
      } else {
        // Read from stdin
        content = await readStdin();
      }

      // Parse frontmatter
      const { data: frontmatter, content: markdown } = matter(content);

      // Determine title (priority: CLI arg > frontmatter > filename > "Untitled")
      let title = options.title || frontmatter.title;
      if (!title && file) {
        title = path.basename(file, path.extname(file));
      }
      if (!title) {
        title = "Untitled";
      }

      // Determine parent (priority: CLI arg > frontmatter)
      const parentDocumentId = options.parent || frontmatter.parentNpi;

      // Create document from markdown
      const document = await client.createDocument(spaceId, {
        title,
        markdown,
        parentDocumentId
      });

      console.log(chalk.green("✓") + " Document created successfully!");
      console.log(chalk.bold(document.title) + chalk.gray(` (${document.id})`));
    }
  }));

documentsCommand
  .command("import <space-id> <directory>")
  .description("Import all markdown files from a directory, maintaining hierarchy")
  .action(withClient(async (client, spaceId, directory) => {
    // Validate directory exists
    if (!fs.existsSync(directory)) {
      console.error(chalk.red("Error:"), `Directory not found: ${directory}`);
      process.exit(1);
    }

    if (!fs.statSync(directory).isDirectory()) {
      console.error(chalk.red("Error:"), `Path is not a directory: ${directory}`);
      process.exit(1);
    }

    console.log(chalk.blue("Starting import from:"), directory);
    console.log(chalk.blue("Target space:"), spaceId);
    console.log();

    const importer = new DirectoryImporter(client, spaceId);
    const results = await importer.importDirectory(directory);

    console.log();
    console.log(chalk.bold("Import Summary:"));
    console.log(chalk.green(`✓ Successful: ${results.successful}`));
    if (results.failed > 0) {
      console.log(chalk.red(`✗ Failed: ${results.failed}`));
    }
    if (results.skipped > 0) {
      console.log(chalk.yellow(`⊘ Skipped: ${results.skipped}`));
    }
    console.log(chalk.gray(`  Total processed: ${results.total}`));

    // Show details if there were failures
    if (results.failed > 0) {
      console.log();
      console.log(chalk.bold("Failed imports:"));
      results.documents
        .filter(d => d.error)
        .forEach(d => {
          console.log(chalk.red(`  ✗ ${d.path}`));
          console.log(chalk.gray(`    ${d.error}`));
        });
    }
  }));

documentsCommand
  .command("update <id>")
  .description("Update a document from markdown file or stdin")
  .argument("[file]", "Markdown file (omit to read from stdin)")
  .action(withClient(async (client, id, file) => {
    // Read content from file or stdin
    let content;
    if (file) {
      content = fs.readFileSync(file, "utf8");
    } else {
      // Read from stdin
      content = await readStdin();
    }

    // Update document
    const document = await client.updateDocument(id, {
      markdown: content
    });

    console.log(chalk.green("✓") + " Document updated successfully!");
    console.log(chalk.bold(document.title) + chalk.gray(` (${document.id})`));
  }));

function printDocumentTree(documents, level) {
  const indent = "  ".repeat(level);

  for (const doc of documents) {
    // Note: nested documents from spaces#show use `npi` as the field name
    console.log(indent + chalk.cyan(doc.title) + chalk.gray(` (${doc.npi})`));

    if (doc.children && doc.children.length > 0) {
      printDocumentTree(doc.children, level + 1);
    }
  }
}

async function readStdin() {
  const chunks = [];

  return new Promise((resolve, reject) => {
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      chunks.push(chunk);
    });

    process.stdin.on("end", () => {
      resolve(chunks.join(""));
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

program.parse();
