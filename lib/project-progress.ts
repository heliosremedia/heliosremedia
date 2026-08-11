export type ProjectProgressState = {
  detailsReady: boolean;
  mediaReady: boolean;
  servicesReady: boolean;
  publishReady: boolean;
};

export function getProjectProgressState(input: {
  hasSummary: boolean;
  hasPlayableVideo: boolean;
  mediaCount: number;
  serviceCount: number;
  status: string;
}): ProjectProgressState {
  return {
    detailsReady: input.hasSummary || input.hasPlayableVideo,
    mediaReady: input.mediaCount > 0,
    servicesReady: input.serviceCount > 0,
    publishReady: input.status === "PUBLISHED",
  };
}
