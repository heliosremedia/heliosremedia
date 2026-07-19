import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "section",
  "article",
  "header",
  "footer",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "small",
  "span",
];

export function sanitizeLegalHtml(content: string) {
  return sanitizeHtml(content, {
    allowedTags,
    allowedAttributes: {
      "*": ["class"],
      a: ["href", "title", "target", "rel"],
      ol: ["start", "type"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto", "tel"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          ...(attributes.target === "_blank"
            ? { rel: "noopener noreferrer" }
            : {}),
        },
      }),
    },
  }).trim();
}

export function containsHtml(content: string) {
  return /<\/?[a-z][^>]*>/i.test(content);
}
