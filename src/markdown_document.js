import matter from "gray-matter";
import path from "path";

// Resolves the title and parent of a markdown document from CLI options, frontmatter and
// the filename. The frontmatter itself is sent along with the body: the server reads
// metadata such as `tags` from it, so stripping it here silently drops them.
export function prepareMarkdownDocument(content, { title, parent, file } = {}) {
  const { data: frontmatter, content: body } = matter(content);

  // Priority: CLI arg > frontmatter > filename > "Untitled"
  const resolvedTitle = title
    || frontmatter.title
    || (file && path.basename(file, path.extname(file)))
    || "Untitled";

  // Priority: CLI arg > frontmatter
  const parentDocumentId = parent || frontmatter.parentId;

  // Re-serialized rather than passed through: the server only recognises frontmatter that
  // opens with a bare "---\n", so a BOM or CRLF line endings would otherwise turn it into
  // document content.
  const markdown = Object.keys(frontmatter).length > 0
    ? matter.stringify(body, frontmatter)
    : body;

  return { title: resolvedTitle, parentDocumentId, markdown };
}
