# Fundamento CLI

Command line client for [Fundamento Cloud](https://fundamento.cloud) - a modern documentation and knowledge management platform.

## Installation

### From GitHub Packages

```bash
# Configure npm to use GitHub Packages for @ikigai-systems scope
npm config set @ikigai-systems:registry https://npm.pkg.github.com

# Install globally
npm install -g @ikigai-systems/fundamento-cli

# Or use with npx (no installation needed)
npx @ikigai-systems/fundamento-cli spaces list
```

### From Source

```bash
git clone https://github.com/Ikigai-Systems/fundamento-cli.git
cd fundamento-cli
npm install
npm link
```

## Configuration

### API Key

You need a Fundamento API key to use this CLI. Get one from your [Fundamento account settings](https://fundamento.cloud).

Set your API key using one of these methods:

1. **Environment variable** (recommended):
   ```bash
   export FUNDAMENTO_API_KEY=your_api_key_here
   ```

2. **`.env` file** (for development):
   ```bash
   echo "FUNDAMENTO_API_KEY=your_api_key_here" > .env
   ```

3. **Command line option**:
   ```bash
   funcli --token your_api_key_here spaces list
   ```

### Base URL

By default, the CLI connects to `https://fundamento.cloud`. For testing or self-hosted instances:

```bash
funcli --base-url http://localhost:3000 spaces list
```

## Usage

```bash
funcli [options] [command]
```

### Global Options

- `-t, --token <token>` - API token (overrides FUNDAMENTO_API_KEY)
- `-u, --base-url <url>` - Base URL (default: https://fundamento.cloud)
- `-V, --version` - Output the version number
- `-h, --help` - Display help

## Commands

### Spaces

#### List all spaces

```bash
funcli spaces list
```

**Example output:**
```
Available Spaces:

Acme Inc. (EsTSuqOvx-)
  └─ 15 documents
Fundamento (Ioku6z_xP_)
  └─ 42 documents
My Space (z2zK66AaEF)
  └─ 8 documents
```

#### Get space details

```bash
funcli spaces get <space-npi>
```

Shows space information with hierarchical document structure.

**Options:**
- `-j, --json` - Output as JSON

**Example:**
```bash
# Human-readable format
funcli spaces get z2zK66AaEF

# JSON format
funcli spaces get z2zK66AaEF --json
```

#### Create a new space

```bash
funcli spaces create <name>
```

Creates a new space. **Note:** Requires manager permissions in your organization.

**Arguments:**
- `<name>` - Space name (must be unique within your organization)

**Options:**
- `-a, --access-mode <mode>` - Access mode: `public`, `restricted`, or `private` (default: `public`)

**Access Modes:**
- **public**: Visible to all organization members
- **restricted**: Visible to organization members but with limited access
- **private**: Only visible to space members and teams

**Examples:**

```bash
# Create a public space (default)
funcli spaces create "My New Space"

# Create a private space
funcli spaces create "Private Team Space" --access-mode private

# Create a restricted space
funcli spaces create "Restricted Space" -a restricted
```

**Note:** When a space is created, a home document is automatically created for it.

### Documents

#### List documents in a space

```bash
funcli documents list <space-npi>
```

**Options:**
- `-j, --json` - Output as JSON

**Example:**
```bash
funcli documents list z2zK66AaEF
```

**Example output:**
```
Documents:

Meeting Notes (abc123)
Project Roadmap (def456)
API Documentation (ghi789)
```

#### Get document content

```bash
funcli documents get <document-npi>
```

Retrieves document content in Markdown format.

**Options:**
- `-f, --format <format>` - Output format: `markdown` (default) or `json`

**Example:**
```bash
# Markdown format (default)
funcli documents get abc123

# JSON format (with metadata)
funcli documents get abc123 --format json
```

#### Create a new document

```bash
funcli documents create <space-npi> [file]
```

Creates a new document from a markdown file or stdin. Supports frontmatter for metadata.

**Arguments:**
- `<space-npi>` - Space NPI where the document will be created
- `[file]` - Path to markdown file (optional, reads from stdin if omitted)

**Options:**
- `-p, --parent <npi>` - Parent document NPI (for nested documents)
- `-t, --title <title>` - Document title (overrides frontmatter and filename)

**Frontmatter Support:**

You can include metadata in your markdown file using YAML frontmatter:

```markdown
---
title: My Document Title
parentNpi: abc123
---

# Document content starts here
```

**Title Resolution Priority:**
1. CLI option (`--title`)
2. Frontmatter (`title`)
3. Filename (without extension)
4. "Untitled" (fallback)

**Parent Resolution Priority:**
1. CLI option (`--parent`)
2. Frontmatter (`parentNpi`)
3. None (document created at space root)

**Examples:**

```bash
# Create from file (title from frontmatter or filename)
funcli documents create z2zK66AaEF my-document.md

# Create from file with custom title
funcli documents create z2zK66AaEF my-document.md --title "Custom Title"

# Create nested document (under parent)
funcli documents create z2zK66AaEF child.md --parent abc123

# Create from stdin
echo "# My Document\n\nContent here" | funcli documents create z2zK66AaEF

# Create from stdin with title
cat document.md | funcli documents create z2zK66AaEF --title "New Document"
```

**Example with frontmatter:**

```bash
# my-document.md
---
title: API Documentation
parentNpi: def456
---

# API Reference

This document contains API documentation...
```

```bash
funcli documents create z2zK66AaEF my-document.md
# Creates "API Documentation" as child of def456
```

#### Import documents from directory

```bash
funcli documents import <space-npi> <directory>
```

Imports all markdown files from a directory, maintaining the folder hierarchy as nested documents.

**Arguments:**
- `<space-npi>` - Space NPI where documents will be imported
- `<directory>` - Path to directory containing markdown files

**Behavior:**
- Recursively traverses the directory
- Creates a document for each subdirectory (using directory name as title)
- Creates a document for each `.md` file (with full content)
- Maintains parent-child relationships based on folder structure
- Skips non-markdown files (`.png`, `.jpg`, `.pdf`, etc.)
- Processes frontmatter in markdown files

**Directory Structure Example:**

```
Notes/
├── README.md
├── Projects/
│   ├── Project A.md
│   └── Project B.md
└── Ideas/
    └── Future Ideas.md
```

**Result:** Creates documents with this hierarchy:
- README (root level)
- Projects (root level)
  - Project A (child of Projects)
  - Project B (child of Projects)
- Ideas (root level)
  - Future Ideas (child of Ideas)

**Examples:**

```bash
# Import entire directory
funcli documents import z2zK66AaEF ./my-notes

# Import with relative path
funcli documents import z2zK66AaEF ../documentation

# Import with absolute path
funcli documents import z2zK66AaEF /home/user/Documents/notes
```

**Output:**

```
Starting import from: ./my-notes
Target space: z2zK66AaEF

Import Summary:
✓ Successful: 15
⊘ Skipped: 3
  Total processed: 15
```

**Notes:**
- Large directories may take some time to import
- Failed imports will be reported with error details
- Non-markdown files are automatically skipped
- Folder names become document titles
- File names (without `.md`) become document titles

## Examples

### Export a document to a file

```bash
funcli documents get abc123 > document.md
```

### Create and import documents

```bash
# Create a simple document
echo "# My Notes\n\nSome content" | funcli documents create z2zK66AaEF --title "Daily Notes"

# Import an existing markdown file
funcli documents create z2zK66AaEF README.md

# Create a nested document hierarchy
funcli documents create z2zK66AaEF parent.md
# Note the NPI of the created document, then:
funcli documents create z2zK66AaEF child.md --parent <parent-npi>

# Batch import multiple documents
for file in docs/*.md; do
  funcli documents create z2zK66AaEF "$file"
done
```

### Search for a space and get its documents

```bash
# List all spaces and find the one you want
funcli spaces list

# Get documents from that space
funcli documents list EsTSuqOvx-

# Read a specific document
funcli documents get def456
```

### Use with jq for JSON processing

```bash
# Get all document titles from a space
funcli documents list z2zK66AaEF --json | jq -r '.[].title'

# Get document with metadata
funcli documents get abc123 --format json | jq '.title, .created_at'
```

### Pipe to other tools

```bash
# Convert document to PDF using pandoc
funcli documents get abc123 | pandoc -f markdown -o document.pdf

# Search within document content
funcli documents get abc123 | grep "TODO"
```

## Development

### Prerequisites

- Node.js >= 24.11.1

### Setup

```bash
git clone https://github.com/Ikigai-Systems/fundamento-cli.git
cd fundamento-cli
npm install
```

### Running locally

```bash
node bin/funcli.js --help
```

### Running tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/Ikigai-Systems/fundamento-cli/issues).

## Related Projects

- [Fundamento Cloud](https://fundamento.cloud) - The main web application
- [Fundamento Documentation](https://fundamento.cloud) - Official documentation
