import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  // Text formatting
  "p", "br", "b", "i", "u", "s", "em", "strong", "sub", "sup", "mark",
  // Headings
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Lists
  "ul", "ol", "li",
  // Links & images
  "a", "img",
  // Tables
  "table", "thead", "tbody", "tr", "th", "td",
  // Block
  "blockquote", "pre", "code", "hr", "div", "span",
  // Media (editor embeds)
  "iframe", "video", "source",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "width", "height",
  "class", "style", "id",
  "colspan", "rowspan",
  "allowfullscreen", "frameborder",
  "controls", "autoplay", "loop", "muted", "type",
  "data-type", "data-youtube-video",
];

/**
 * Sanitize HTML content (safe for both server and client usage).
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "style", "textarea", "form", "input", "select", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });
}

/**
 * HTML-escape plain text (e.g., search query strings).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
