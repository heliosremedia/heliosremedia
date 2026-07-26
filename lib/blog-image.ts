export type BlogImagePromptContext = {
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
  category?: string | null;
  seoTitle?: string | null;
};

function compact(value: string | null | undefined, limit: number) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function prepareBlogImagePrompt(context: BlogImagePromptContext) {
  const title = compact(context.title, 180);
  const excerpt = compact(context.excerpt, 500);
  const article = compact(context.content, 1_000);
  const category = compact(context.category, 120);
  const seoTopic = compact(context.seoTitle, 180);
  const details = [
    title && `Article title: ${title}`,
    category && `Category: ${category}`,
    seoTopic && `SEO topic: ${seoTopic}`,
    excerpt && `Excerpt: ${excerpt}`,
    article && `Article context: ${article}`,
  ].filter(Boolean);
  if (!details.length) return "";
  return [
    "Create an original editorial featured image for a Helios Real Estate Media blog article.",
    ...details,
    "Visual direction: refined, cinematic, natural, premium, sophisticated dark-neutral palette with restrained warm accents. Landscape 3:2 composition with a clear editorial focal point.",
    "Do not include logos, watermarks, readable text, identifiable people, invented client results, or a fabricated property presented as authentic Helios portfolio work.",
  ].join("\n");
}

export function suggestBlogImageAltText(context: BlogImagePromptContext) {
  const title = compact(context.title, 180);
  return title ? `Editorial featured image for ${title}` : "Editorial Helios real estate media featured image";
}
