import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  // 텍스트 서식
  "p", "br", "b", "i", "u", "s", "em", "strong", "sub", "sup", "mark",
  // 제목
  "h1", "h2", "h3", "h4", "h5", "h6",
  // 목록
  "ul", "ol", "li",
  // 링크 & 이미지
  "a", "img",
  // 테이블
  "table", "thead", "tbody", "tr", "th", "td",
  // 블록
  "blockquote", "pre", "code", "hr", "div", "span",
  // 미디어 (에디터 임베드)
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
 * HTML 콘텐츠를 sanitize합니다 (서버/클라이언트 모두 사용 가능)
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
 * 일반 텍스트를 HTML 이스케이프합니다 (검색어 등)
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
