export const EMAIL_STUDIO_VIEWS = [
  { id: "compose", label: "Compose" },
  { id: "campaigns", label: "Campaigns" },
  { id: "health", label: "Delivery health" },
] as const;

export type EmailStudioView = typeof EMAIL_STUDIO_VIEWS[number]["id"];

export const EMAIL_CAMPAIGN_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "DRAFT", label: "Drafts" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "SENT", label: "Sent" },
  { id: "ISSUES", label: "Needs attention" },
] as const;

export type EmailCampaignFilter = typeof EMAIL_CAMPAIGN_FILTERS[number]["id"];

type CampaignListItem = {
  subject: string;
  status: string;
  failedCount?: number;
  delivery?: { failed: number };
};

/** Filtering is presentation-only: it preserves source order and campaign records. */
export function filterEmailCampaigns<T extends CampaignListItem>(
  campaigns: readonly T[], filter: EmailCampaignFilter, query = "",
): T[] {
  const search = query.trim().toLocaleLowerCase();
  return campaigns.filter((campaign) => {
    const matchesStatus = filter === "ALL"
      || (filter === "SENT" ? ["SENT", "PARTIAL"].includes(campaign.status)
        : filter === "ISSUES" ? ["FAILED", "PARTIAL"].includes(campaign.status)
          || (campaign.failedCount ?? 0) > 0 || (campaign.delivery?.failed ?? 0) > 0
          : campaign.status === filter);
    return matchesStatus && (!search || campaign.subject.toLocaleLowerCase().includes(search));
  });
}
