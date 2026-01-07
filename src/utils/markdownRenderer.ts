/**
 * Markdown Renderer for Terminal
 *
 * Simple markdown-to-terminal renderer that handles common patterns.
 */

import { highlight } from "cli-highlight";
import { colors as c } from "./colors.js";

/**
 * Render markdown content for terminal display
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown || markdown.trim() === "") {
    return "";
  }

  let result = markdown;

  // Process code blocks first (before other transformations)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    let highlighted = code.trimEnd();
    try {
      highlighted = highlight(code.trimEnd(), { language: lang || "plaintext" });
    } catch {
      // Keep original if highlighting fails
    }
    return `\n${c.gray}───${c.reset}\n${highlighted}\n${c.gray}───${c.reset}\n`;
  });

  // Inline code - cyan to stand out from prose
  result = result.replace(/`([^`]+)`/g, `${c.cyan}\`$1\`${c.reset}`);

  // Headers - bold, h1/h2 get color for hierarchy
  result = result.replace(/^######\s+(.+)$/gm, `${c.bold}$1${c.reset}`);
  result = result.replace(/^#####\s+(.+)$/gm, `${c.bold}$1${c.reset}`);
  result = result.replace(/^####\s+(.+)$/gm, `${c.bold}$1${c.reset}`);
  result = result.replace(/^###\s+(.+)$/gm, `${c.bold}$1${c.reset}`);
  result = result.replace(/^##\s+(.+)$/gm, `${c.bold}${c.blue}$1${c.reset}`);
  result = result.replace(/^#\s+(.+)$/gm, `${c.bold}${c.cyan}$1${c.reset}`);

  // Bold and italic - just formatting, no color
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, `${c.bold}${c.italic}$1${c.reset}`);
  result = result.replace(/\*\*(.+?)\*\*/g, `${c.bold}$1${c.reset}`);
  result = result.replace(/\*(.+?)\*/g, `${c.italic}$1${c.reset}`);
  result = result.replace(/_(.+?)_/g, `${c.italic}$1${c.reset}`);

  // Strikethrough - gray (de-emphasized)
  result = result.replace(/~~(.+?)~~/g, `${c.gray}$1${c.reset}`);

  // Blockquotes - gray (secondary content)
  result = result.replace(/^>\s*(.*)$/gm, `${c.gray}│ $1${c.reset}`);

  // Unordered lists - subtle bullet
  result = result.replace(/^(\s*)[-*+]\s+(.+)$/gm, `$1${c.gray}•${c.reset} $2`);

  // Ordered lists - subtle number
  result = result.replace(/^(\s*)(\d+)\.\s+(.+)$/gm, `$1${c.gray}$2.${c.reset} $3`);

  // Links - blue text (web standard), gray URL
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `${c.blue}${c.underline}$1${c.reset} ${c.gray}($2)${c.reset}`);

  // Horizontal rules
  result = result.replace(/^[-*_]{3,}$/gm, `${c.gray}────────────────────────────────────────${c.reset}`);

  // Task lists - green check, gray unchecked
  result = result.replace(/^(\s*)[-*+]\s+\[x\]\s+(.+)$/gim, `$1${c.green}✓${c.reset} $2`);
  result = result.replace(/^(\s*)[-*+]\s+\[\s?\]\s+(.+)$/gim, `$1${c.gray}○${c.reset} $2`);

  return result;
}

/**
 * Check if content appears to be markdown
 */
export function isLikelyMarkdown(content: string): boolean {
  if (!content || content.trim() === "") {
    return false;
  }

  const markdownPatterns = [
    /^#{1,6}\s+/m,
    /\*\*[^*]+\*\*/,
    /`[^`]+`/,
    /^```/m,
    /^\s*[-*+]\s+/m,
    /^\s*\d+\.\s+/m,
    /\[.+\]\(.+\)/,
    /^\s*>\s+/m,
  ];

  return markdownPatterns.some(pattern => pattern.test(content));
}

/**
 * Render content - applies markdown formatting if detected
 */
export function renderContent(content: string | null | undefined): string {
  if (!content) {
    return "(no content)";
  }

  if (isLikelyMarkdown(content)) {
    return renderMarkdown(content);
  }

  return content;
}
