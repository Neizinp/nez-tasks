/**
 * MarkdownParser - Shared YAML frontmatter parsing and serialization
 */

/**
 * Parse YAML frontmatter from markdown content
 * @param {string} content - Markdown content
 * @returns {Object} { frontmatter: Object, body: string }
 */
export function parseMarkdown(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter = {};
  const yamlLines = match[1].split('\n');
  
  for (const line of yamlLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Parse values
      if (value === 'null' || value === '') {
        value = null;
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (/^-?\d+$/.test(value)) {
        value = parseInt(value, 10);
      } else if (/^-?\d+\.\d+$/.test(value)) {
        value = parseFloat(value);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: match[2].trim() };
}

/**
 * Serialize an object to YAML frontmatter format
 * @param {Object} data - Object to serialize
 * @returns {string} YAML frontmatter string (without --- delimiters)
 */
export function serializeToYaml(data) {
  return Object.entries(data)
    .map(([key, value]) => {
      if (value === null) {
        return `${key}: null`;
      } else if (typeof value === 'string') {
        return `${key}: "${value}"`;
      } else if (Array.isArray(value)) {
        return `${key}: ["${value.join('", "')}"]`;
      } else {
        return `${key}: ${value}`;
      }
    })
    .join('\n');
}

/**
 * Create a full markdown document with frontmatter
 * @param {Object} frontmatter - Frontmatter data
 * @param {string} body - Body content
 * @returns {string} Complete markdown document
 */
export function createMarkdown(frontmatter, body = '') {
  return `---\n${serializeToYaml(frontmatter)}\n---\n${body}`;
}
