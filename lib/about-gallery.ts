export type AboutGalleryCandidate = {
  assetId: string;
  label: string;
  altText: string;
  width?: number | null;
  height?: number | null;
};

const detailWords = /\b(detail|close|texture|fixture|fireplace|stair|finish)\b/i;
const exteriorWords = /\b(exterior|front|backyard|aerial|drone|patio|pool|view)\b/i;

function category(item: AboutGalleryCandidate) {
  const description = `${item.label} ${item.altText}`;
  if (detailWords.test(description)) return "detail";
  if (exteriorWords.test(description)) return "exterior";
  return "interior";
}

export function selectBalancedAboutImages<T extends AboutGalleryCandidate>(
  candidates: T[],
  random = Math.random,
) {
  const unique = candidates.filter(
    (item, index, list) =>
      list.findIndex((other) => other.assetId === item.assetId) === index,
  );
  if (unique.length < 3) return [];
  const shuffled = unique
    .map((item) => ({ item, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
  const chosen: T[] = [];
  for (const desired of ["interior", "detail", "exterior"]) {
    const match = shuffled.find(
      (item) =>
        category(item) === desired &&
        !chosen.some((selected) => selected.assetId === item.assetId),
    );
    if (match) chosen.push(match);
  }
  for (const item of shuffled) {
    if (chosen.length === 3) break;
    if (!chosen.some((selected) => selected.assetId === item.assetId)) {
      chosen.push(item);
    }
  }
  return chosen;
}
