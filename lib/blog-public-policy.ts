export function canPreviewBlogPost(sessionWorkspaceId: string | undefined, publicWorkspaceId: string, postWorkspaceId: string | null) {
  return sessionWorkspaceId === publicWorkspaceId && (postWorkspaceId === null || postWorkspaceId === publicWorkspaceId);
}
