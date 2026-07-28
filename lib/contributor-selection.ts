export type ContributorSearchUser = {
  id: string;
  displayName: string;
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  disciplines: string[];
};

export function filterContributorUsers(
  users: ContributorSearchUser[],
  selectedIds: Array<string | null>,
  search: string,
) {
  const selected = new Set(selectedIds.filter((id): id is string => Boolean(id)));
  const query = search.trim().toLowerCase();
  return users.filter(user => !selected.has(user.id) && [
    user.displayName, user.title, user.firstName, user.lastName, user.email, ...user.disciplines,
  ].filter(Boolean).join(" ").toLowerCase().includes(query));
}
