import "server-only";

import { getHdPhotoHubUsers } from "@/lib/client-portal/hdphotohub";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone } from "./normalization";
import { reconcileUnsubscribedGroup } from "./preferences";

export async function syncHdPhotoHubClients() {
  const clients = await getHdPhotoHubUsers();
  const syncedAt = new Date();
  const existing = await prisma.communicationClient.findMany({
    where: { hdPhotoHubUserId: { in: clients.map((client) => client.uid) } },
    select: { hdPhotoHubUserId: true },
  });
  const existingIds = new Set(existing.map((client) => client.hdPhotoHubUserId));

  const writes = clients.map((client) =>
    prisma.communicationClient.upsert({
      where: { hdPhotoHubUserId: client.uid },
      create: {
        hdPhotoHubUserId: client.uid,
        firstName: client.firstName,
        lastName: client.lastName,
        displayName: client.displayName,
        email: client.email,
        normalizedEmail: normalizeEmail(client.email),
        phone: client.phone,
        normalizedPhone: normalizePhone(client.phone),
        lastSyncedAt: syncedAt,
      },
      update: {
        firstName: client.firstName,
        lastName: client.lastName,
        displayName: client.displayName,
        email: client.email,
        normalizedEmail: normalizeEmail(client.email),
        phone: client.phone,
        normalizedPhone: normalizePhone(client.phone),
        lastSyncedAt: syncedAt,
      },
    }),
  );

  for (let index = 0; index < writes.length; index += 25) {
    await Promise.all(writes.slice(index, index + 25));
  }
  const normalizedEmails = [...new Set(clients.map(client => normalizeEmail(client.email)).filter(Boolean))];
  const blocked = await prisma.marketingEmailPreference.findMany({
    where: { normalizedEmail: { in: normalizedEmails }, status: { in: ["UNSUBSCRIBED", "SUPPRESSED"] } },
    select: { normalizedEmail: true, effectiveAt: true },
  });
  const blockedByEmail = new Map(blocked.map(preference => [preference.normalizedEmail, preference]));
  for (const normalizedEmail of normalizedEmails) {
    const preference = blockedByEmail.get(normalizedEmail);
    await prisma.communicationClient.updateMany({
      where: { normalizedEmail },
      data: {
        emailSubscribed: !preference,
        unsubscribedAt: preference?.effectiveAt ?? null,
      },
    });
    await reconcileUnsubscribedGroup(normalizedEmail);
  }

  const updated = clients.filter((client) => existingIds.has(client.uid)).length;
  const created = clients.length - updated;
  return { total: clients.length, created, updated, syncedAt };
}
