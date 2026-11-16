const limits = {
  title: 120, slug: 140, shortDescription: 320, description: 6000,
  city: 120, state: 120, locationLabel: 180, projectType: 120, propertyType: 120,
  propertyAddress: 300,
} as const;

export function readProjectCreateInput(formData: FormData) {
  const values = Object.fromEntries(Object.entries(limits).map(([field, maximum]) => {
    const raw = formData.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value.length > maximum) throw new Error(`${field} must be ${maximum} characters or fewer.`);
    return [field, value];
  })) as Record<keyof typeof limits, string>;
  if (!values.title) throw new Error("Enter a project title before continuing.");
  return values;
}
