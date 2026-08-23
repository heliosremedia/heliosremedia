type SocialConnectionIdentity = {
  platform: string;
  providerAccountId: string | null;
};

const isPlaceholderConnection = ({ providerAccountId }: SocialConnectionIdentity) =>
  !providerAccountId || providerAccountId.startsWith("pending-");

export function visibleSocialConnections<T extends SocialConnectionIdentity>(connections: T[]) {
  const platformsWithRealDestinations = new Set(
    connections
      .filter((connection) => !isPlaceholderConnection(connection))
      .map((connection) => connection.platform),
  );

  return connections.filter(
    (connection) =>
      !(
        platformsWithRealDestinations.has(connection.platform) &&
        isPlaceholderConnection(connection)
      ),
  );
}
