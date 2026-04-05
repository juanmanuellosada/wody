/**
 * Server component: renders a subset of Markdown to HTML.
 * Supports: **bold**, _italic_, # headings, - bullet lists, 1. ordered lists.
 * Also handles legacy Tiptap JSON content gracefully.
 * Zero client JS.
 */

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseInline(text: string): string {
  let result = escapeHtml(text);
  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_ (but not inside **)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");
  return result;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

  function closeList() {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) { html.push("</ol>"); inOl = false; }
      if (!inUl) { html.push("<ul>"); inUl = true; }
      html.push(`<li>${parseInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (inUl) { html.push("</ul>"); inUl = false; }
      if (!inOl) { html.push("<ol>"); inOl = true; }
      html.push(`<li>${parseInline(olMatch[1])}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      closeList();
      continue;
    }

    // Regular paragraph
    closeList();
    html.push(`<p>${parseInline(line)}</p>`);
  }

  closeList();
  return html.join("\n");
}

/**
 * Extracts plain text from legacy Tiptap JSON content.
 * Converts it to readable Markdown as best as possible.
 */
function tiptapJsonToMarkdown(json: unknown): string {
  const lines: string[] = [];

  function walk(node: unknown, listType?: "ul" | "ol", listIndex?: number): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    const type = n.type as string | undefined;
    const children = n.content as unknown[] | undefined;

    if (type === "text") {
      // Return text with marks
      let text = (n.text as string) ?? "";
      const marks = n.marks as Array<{ type: string }> | undefined;
      if (marks) {
        for (const mark of marks) {
          if (mark.type === "bold") text = `**${text}**`;
          if (mark.type === "italic") text = `_${text}_`;
        }
      }
      lines.push(text);
      return;
    }

    if (type === "heading") {
      const level = ((n.attrs as Record<string, unknown>)?.level as number) ?? 2;
      const prefix = "#".repeat(level) + " ";
      lines.push("\n" + prefix);
      children?.forEach((c) => walk(c));
      lines.push("\n");
      return;
    }

    if (type === "bulletList") {
      children?.forEach((c) => walk(c, "ul"));
      return;
    }

    if (type === "orderedList") {
      let idx = 0;
      children?.forEach((c) => { idx++; walk(c, "ol", idx); });
      return;
    }

    if (type === "listItem") {
      const prefix = listType === "ol" ? `${listIndex ?? 1}. ` : "- ";
      lines.push(prefix);
      children?.forEach((child) => {
        const cn = child as Record<string, unknown>;
        if (cn.type === "paragraph") {
          (cn.content as unknown[] | undefined)?.forEach((c) => walk(c));
        }
      });
      lines.push("\n");
      return;
    }

    if (type === "paragraph") {
      children?.forEach((c) => walk(c));
      lines.push("\n");
      return;
    }

    // Fallback: just walk children
    children?.forEach((c) => walk(c));
  }

  walk(json);
  return lines.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function isLegacyTiptapJson(content: string): boolean {
  return content.trimStart().startsWith("{") && content.includes('"type"');
}

export function normalizeContent(content: string): string {
  if (!isLegacyTiptapJson(content)) return content;

  try {
    const parsed = JSON.parse(content);
    return tiptapJsonToMarkdown(parsed);
  } catch {
    return content;
  }
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content || !content.trim()) {
    return <p className="text-gray-600 italic text-sm">Sin contenido</p>;
  }

  const normalized = normalizeContent(content);
  const html = markdownToHtml(normalized);

  return (
    <div
      className={[
        "prose prose-invert max-w-none font-body",
        "prose-p:text-gray-300 prose-p:my-1 prose-p:leading-relaxed",
        "prose-strong:text-white prose-strong:font-bold",
        "prose-em:text-gray-300",
        "prose-h1:text-white prose-h1:font-heading prose-h1:font-black prose-h1:uppercase prose-h1:tracking-[0.1em] prose-h1:text-xl prose-h1:mt-3 prose-h1:mb-1",
        "prose-h2:text-white prose-h2:font-heading prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-[0.1em] prose-h2:text-lg prose-h2:mt-3 prose-h2:mb-1",
        "prose-h3:text-white prose-h3:font-heading prose-h3:font-bold prose-h3:uppercase prose-h3:tracking-[0.05em] prose-h3:text-base prose-h3:mt-2 prose-h3:mb-1",
        "prose-ul:text-gray-300 prose-ul:my-1 prose-ul:list-disc prose-ul:pl-5",
        "prose-ol:text-gray-300 prose-ol:my-1 prose-ol:list-decimal prose-ol:pl-5",
        "prose-li:my-0.5",
        className,
      ].join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Utility for extracting preview text (used in teacher WOD cards) */
export function getContentPreview(content: string, maxLen = 200): string {
  const normalized = normalizeContent(content);
  return normalized.replace(/[#*_\-\d.]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLen);
}
