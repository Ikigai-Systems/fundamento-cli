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

## Examples

### Export a document to a file

```bash
funcli documents get abc123 > document.md
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

## API Endpoints

The CLI uses the Fundamento REST API v1:

- `GET /api/v1/spaces` - List spaces
- `GET /api/v1/spaces/:npi` - Get space details
- `GET /api/v1/spaces/:space_npi/documents` - List documents in a space
- `GET /api/v1/documents/:npi` - Get document content

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/Ikigai-Systems/fundamento-cli/issues).

## Related Projects

- [Fundamento Cloud](https://fundamento.cloud) - The main web application
- [Fundamento Documentation](https://fundamento.cloud) - Official documentation
