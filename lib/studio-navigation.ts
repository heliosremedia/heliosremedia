export const studioNavigation = [
  { label: "Workspace", links: [
    { label: "Command Center", href: "/admin/studio" },
    { label: "Projects", href: "/admin/projects" },
    { label: "Media Library", href: "/admin/media" },
    { label: "Clients", href: "/admin/clients" },
    { label: "Inquiries", href: "/admin/inquiries" },
    { label: "Client Portals", href: "/admin/client-portals" },
  ] },
  { label: "Marketing Studio", links: [
    { label: "Email", href: "/admin/email-studio" },
    { label: "Newsletters", href: "/admin/newsletter-studio" },
    { label: "Social", href: "/admin/social-studio" },
    { label: "Blog", href: "/admin/blog" },
    { label: "Referrals", href: "/admin/referral-studio" },
    { label: "Publishing calendar", href: "/admin/social-studio/calendar" },
  ] },
  { label: "Manage", links: [
    { label: "Portfolio & Website", href: "/admin/homepage" },
    { label: "Portfolio Analytics", href: "/admin/portfolio-intelligence" },
    { label: "Connections", href: "/admin/social-studio/settings" },
    { label: "Team & Permissions", href: "/admin/users" },
    { label: "Brand & Settings", href: "/admin/settings" },
    { label: "Activity", href: "/admin/activity" },
    { label: "Original dashboard", href: "/admin" },
  ] },
] as const;

export function studioLinkIsActive(path: string, href: string) {
  // Select the most specific existing module route, never two parent/child entries.
  const matches = studioNavigation.flatMap(group => [...group.links])
    .filter(link => path === link.href || (link.href !== "/admin" && path.startsWith(`${link.href}/`)))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href === href;
}
