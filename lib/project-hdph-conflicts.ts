export type HDPHDetailValues = Partial<Record<"title" | "city" | "state" | "locationLabel" | "propertyAddress", string>>;
export function hdphDetailConflicts(current: HDPHDetailValues, incoming: HDPHDetailValues) {
  return (Object.keys(current) as (keyof HDPHDetailValues)[]).filter(key => {
    const value = current[key]?.trim() || "";
    return value !== "" && value !== (incoming[key]?.trim() || "");
  });
}
