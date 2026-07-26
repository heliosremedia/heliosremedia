export const NEWSLETTER_PROJECT_PAGE_SIZE = 60;

export type NewsletterGalleryQuery = {
  search: string;
  source: "ALL" | "PORTFOLIO" | "BLOG" | "AI";
  projectId: string | null;
  page: number;
};

export function parseNewsletterGalleryQuery(params: URLSearchParams): NewsletterGalleryQuery {
  const requestedSource = (params.get("source") || "ALL").toUpperCase();
  const requestedPage = Number.parseInt(params.get("page") || "1", 10);
  return {
    search: (params.get("search") || "").trim().slice(0, 100),
    source: ["ALL", "PORTFOLIO", "BLOG", "AI"].includes(requestedSource)
      ? requestedSource as NewsletterGalleryQuery["source"]
      : "ALL",
    projectId: (params.get("projectId") || "").trim().slice(0, 100) || null,
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export function orderProjectMedia<T extends { id: string; displayOrder: number }>(
  media: T[],
  coverId?: string | null,
) {
  return [...media].sort((left, right) => {
    if (left.id === coverId) return -1;
    if (right.id === coverId) return 1;
    return left.displayOrder - right.displayOrder;
  });
}
