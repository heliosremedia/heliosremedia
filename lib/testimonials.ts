export const TESTIMONIAL_CHARACTER_LIMIT = 180;

export function displayTestimonial(value: string) {
  if (value.length <= TESTIMONIAL_CHARACTER_LIMIT) return value;

  const shortened = value.slice(0, TESTIMONIAL_CHARACTER_LIMIT - 1);
  const lastSpace = shortened.lastIndexOf(" ");

  return `${shortened.slice(0, lastSpace > 135 ? lastSpace : shortened.length).trimEnd()}…`;
}
