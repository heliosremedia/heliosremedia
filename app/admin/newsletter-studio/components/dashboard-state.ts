import type { NewsletterDashboardData } from "../types";

export function updateSeriesActive(
  data: NewsletterDashboardData,
  seriesId: string,
  active: boolean,
) {
  return {
    ...data,
    series: data.series.map((series) => series.id === seriesId
      ? { ...series, active }
      : series),
  };
}
