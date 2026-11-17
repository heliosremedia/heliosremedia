export function buildProjectsUrl({
  status,
  search,
  page,
  pageSize,
}: {
  status: string;
  search: string;
  page?: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();

  if (status !== "ALL") params.set("status", status);
  if (search) params.set("search", search);
  if (page && page > 1) params.set("page", String(page));
  if (pageSize !== 30) params.set("pageSize", String(pageSize));

  return `${params.size ? `/admin/projects?${params}` : "/admin/projects"}#project-results`;
}

