export type ProjectProgressState = {
  detailsReady: boolean;
  mediaReady: boolean;
  servicesReady: boolean;
  publishReady: boolean;
};

export function getProjectProgressState(input: {
  hasSummary: boolean;
  hasPlayableVideo: boolean;
  hasLeadMedia: boolean;
  mediaCount: number;
  serviceCount: number;
  status: string;
}): ProjectProgressState {
  const detailsReady = input.hasSummary || input.hasPlayableVideo;
  const mediaReady = (input.hasLeadMedia || input.hasPlayableVideo) && input.mediaCount > 0;
  const servicesReady = input.serviceCount > 0;
  return {
    detailsReady,
    mediaReady,
    servicesReady,
    publishReady: input.status === "PUBLISHED" && detailsReady && mediaReady && servicesReady,
  };
}
