import "server-only";

const DEFAULT_BASE_URL = "https://photos.heliosrealestatemedia.com/api/v1";

export type HdPhotoHubBrand = { bid: number; name: string };
export type HdPhotoHubGroup = { gid: number; name: string };
export type HdPhotoHubUser = {
  uid: number;
  bid: number;
  email: string;
  firstname?: string;
  lastname?: string;
  status?: "active" | "inactive" | "deleted";
  type?: "team-member" | "group-admin" | "client" | "assistant";
  group?: { gid?: number; id?: number; name?: string } | null;
};

export class HdPhotoHubError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "HdPhotoHubError";
  }
}

function configuration() {
  const apiKey = process.env.HDPH_API_KEY?.trim();
  if (!apiKey) throw new HdPhotoHubError("HDPhotoHub is not connected.");
  return {
    apiKey,
    baseUrl: (process.env.HDPH_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, baseUrl } = configuration();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      api_key: apiKey,
      ...init?.headers,
    },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new HdPhotoHubError(
      response.status === 404 ? "The HDPhotoHub record was not found." : "HDPhotoHub could not complete the request.",
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function isHdPhotoHubConfigured() {
  return Boolean(process.env.HDPH_API_KEY?.trim());
}

export function getHdPhotoHubBrand() {
  return request<HdPhotoHubBrand>("/brand");
}

export async function getHdPhotoHubGroups() {
  const groups = await request<HdPhotoHubGroup[]>("/groups");
  return groups
    .filter((group) => Number.isInteger(Number(group.gid)) && Boolean(group.name?.trim()))
    .map((group) => ({ gid: Number(group.gid), name: group.name.trim() }));
}

export async function getHdPhotoHubUser(email: string) {
  try {
    const user = await request<HdPhotoHubUser>(`/user${query({ email })}`);
    if (!Number.isInteger(Number(user?.uid))) return null;
    return { ...user, uid: Number(user.uid) };
  } catch (error) {
    if (error instanceof HdPhotoHubError && error.status === 404) return null;
    throw error;
  }
}

export function getHdPhotoHubSso(email: string) {
  return request<{ uid: number; sessionkey: string; url: string }>(`/user/sso${query({ email })}`);
}

export function createHdPhotoHubClient(input: {
  brandId: number;
  groupId?: number | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
}) {
  return request<HdPhotoHubUser>(`/user${query({
    bid: input.brandId,
    gid: input.groupId ?? undefined,
    email: input.email,
    firstname: input.firstName,
    lastname: input.lastName,
    name: `${input.firstName} ${input.lastName}`.trim(),
    phone: input.phone || undefined,
    status: "active",
    type: "client",
  })}`, { method: "PUT" });
}

export function setHdPhotoHubPassword(userId: number, password: string) {
  const body = new URLSearchParams({ uid: String(userId), password });
  return request<{ uid: number }>("/user/password", {
    method: "PUT",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
}

export function userBelongsToGroup(user: HdPhotoHubUser, groupId: number | null) {
  if (groupId === null) return true;
  return Number(user.group?.gid ?? user.group?.id) === groupId;
}
