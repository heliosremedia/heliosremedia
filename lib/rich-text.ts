import sanitizeHtml from "sanitize-html";

const allowedTags = ["p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "a"];

export function sanitizeRichText(content: string) {
  return sanitizeHtml(content, {
    allowedTags,
    allowedAttributes: { a: ["href", "title", "target", "rel"], ol: ["start", "type"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { a: ["http", "https", "mailto", "tel"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          ...(attributes.target === "_blank" ? { rel: "noopener noreferrer" } : {}),
        },
      }),
    },
  }).trim();
}

export function richTextToPlainText(content: string) {
  return sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
