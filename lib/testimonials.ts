export const TESTIMONIAL_CHARACTER_LIMIT = 180;

export function displayTestimonial(value: string) {
  if (value.length <= TESTIMONIAL_CHARACTER_LIMIT) return value;

  const shortened = value.slice(0, TESTIMONIAL_CHARACTER_LIMIT - 1);
  const lastSpace = shortened.lastIndexOf(" ");

  return `${shortened.slice(0, lastSpace > 135 ? lastSpace : shortened.length).trimEnd()}…`;
}

// Curated Google reviews are eligible too; keep their original provenance intact.
export const featuredTestimonialWhere = { published: true, featured: true } as const;

export type TestimonialPosition = "active" | "left" | "right" | "hidden";

export function getTestimonialPosition(index: number, activeIndex: number, total: number): TestimonialPosition {
  if (total < 1 || index < 0 || index >= total) return "hidden";
  const distance = (index - activeIndex + total) % total;
  if (distance === 0) return "active";
  if (distance === 1) return "right";
  if (distance === total - 1) return "left";
  return "hidden";
}
