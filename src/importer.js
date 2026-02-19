import fs from "fs";
import path from "path";
import matter from "gray-matter";

export class DirectoryImporter {
  constructor(client, spaceNpi) {
    this.client = client;
    this.spaceNpi = spaceNpi;
    this.pathToNpiMap = new Map(); // Maps directory paths to document NPIs
  }

  async importDirectory(dirPath) {
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      documents: []
    };

    await this._traverseAndImport(dirPath, null, results);

    return results;
  }

  async _traverseAndImport(currentPath, parentNpi, results) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    // Sort: directories first, then files
    const directories = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(e => e.isFile()).sort((a, b) => a.name.localeCompare(b.name));

    // Process directories first (so they can be parents for files)
    for (const dir of directories) {
      const fullPath = path.join(currentPath, dir.name);

      try {
        results.total++;

        // Create a document for this directory
        const dirDoc = await this.client.createDocument(this.spaceNpi, {
          title: dir.name,
          markdown: `# ${dir.name}`,
          parentDocumentNpi: parentNpi
        });

        results.successful++;
        results.documents.push({
          type: "directory",
          path: fullPath,
          npi: dirDoc.id,
          title: dirDoc.title,
          parent: parentNpi
        });

        // Store the NPI for this directory
        this.pathToNpiMap.set(fullPath, dirDoc.id);

        // Recursively process contents of this directory
        await this._traverseAndImport(fullPath, dirDoc.id, results);

      } catch (error) {
        results.failed++;
        results.documents.push({
          type: "directory",
          path: fullPath,
          error: error.message
        });
      }
    }

    // Process files
    for (const file of files) {
      const fullPath = path.join(currentPath, file.name);
      const ext = path.extname(file.name).toLowerCase();

      // Only process markdown files
      if (ext !== ".md") {
        results.skipped++;
        results.documents.push({
          type: "skipped",
          path: fullPath,
          reason: `Unsupported file type: ${ext}`
        });
        continue;
      }

      try {
        results.total++;

        // Read and parse the markdown file
        const content = fs.readFileSync(fullPath, "utf8");
        const { data: frontmatter, content: markdown } = matter(content);

        // Determine title: frontmatter.title or filename without extension
        const title = frontmatter.title || path.basename(file.name, ext);

        // Create the document
        const doc = await this.client.createDocument(this.spaceNpi, {
          title,
          markdown,
          parentDocumentNpi: parentNpi
        });

        results.successful++;
        results.documents.push({
          type: "file",
          path: fullPath,
          npi: doc.id,
          title: doc.title,
          parent: parentNpi,
          hasFrontmatter: Object.keys(frontmatter).length > 0
        });

      } catch (error) {
        results.failed++;
        results.documents.push({
          type: "file",
          path: fullPath,
          error: error.message
        });
      }
    }
  }
}
