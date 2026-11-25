import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManagePhotoVaContacts } from "@/lib/studio-photo-va-settings";
import { savePhotoVaContact } from "./actions";

export const dynamic = "force-dynamic";

const outcomes: Record<string,string> = {
  saved: "Contact saved. No email was sent.",
  invalid: "Choose an existing team profile and enter a valid email address.",
  missing: "That team profile or contact no longer exists. Refresh and try again.",
  limit: "Disable an existing contact before enabling another.",
  unavailable: "Studio could not save this change. Please try again.",
};

const field = "block min-h-11 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)]";

export default async function PhotoVaContactsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await getAdminSession();
  if (!actor) redirect("/login?next=%2Fadmin%2Fphoto-va-contacts");
  if (!canManagePhotoVaContacts(actor, process.env.PHOTO_VA_WORKSPACE_ID)) notFound();
  const [members, contacts, params] = await Promise.all([
    prisma.teamMember.findMany({ orderBy: [{name:"asc"},{id:"asc"}], take: 100, select:{id:true,name:true,title:true} }),
    prisma.photoVaContact.findMany({
      where: { workspaceId:actor.workspaceId },
      orderBy: [{teamMember:{name:"asc"}},{teamMemberId:"asc"}],
      select:{teamMemberId:true,email:true,enabled:true,teamMember:{select:{name:true,title:true}}},
    }),
    searchParams,
  ]);
  const known = new Set(contacts.map(item => item.teamMemberId));
  const candidates = members.filter(item => !known.has(item.id));
  const message = typeof params.status === "string" && Object.hasOwn(outcomes, params.status) ? outcomes[params.status] : null;

  return <main className="admin-form-scope mx-auto max-w-3xl space-y-7">
    <header className="border-b border-white/10 pb-6">
      <Link href="/admin/users" className="text-sm text-white/60 hover:text-white">Back to Accounts &amp; Users</Link>
      <p className="eyebrow mt-6 text-[var(--helios-orange)]">Uploader settings</p>
      <h1 className="mt-2 text-3xl font-light tracking-tight">Photo VA contacts</h1>
      <p className="mt-3 max-w-xl text-sm text-white/55">Choose who can receive optional photo notes once AutoHDR confirms a batch. A contact does not get a login, an invitation, or access to Studio.</p>
    </header>
    {message && <p role="status" className="rounded-lg border border-white/10 px-4 py-3 text-sm">{message}</p>}
    {candidates.length > 0 && <form action={savePhotoVaContact} className="space-y-4 rounded-xl border border-white/10 p-5">
      <h2 className="text-lg font-medium">Add a mail-only contact</h2>
      <label className="block space-y-2 text-sm">Existing team profile
        <select name="teamMemberId" defaultValue="" required className={field}>
          <option value="" disabled>Choose a profile</option>
          {candidates.map(member => <option key={member.id} value={member.id}>{member.name}{member.title ? " · " + member.title : ""}</option>)}
        </select>
      </label>
      <label className="block space-y-2 text-sm">Private delivery email
        <input name="email" type="email" required maxLength={254} autoComplete="off" className={field} />
      </label>
      <button name="intent" value="enable" className="admin-btn-primary">Enable contact</button>
    </form>}
    {contacts.map(({teamMemberId,email,enabled,teamMember}) => <section key={teamMemberId} className="space-y-3 rounded-xl border border-white/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{teamMember.name}</h2>
        <span className={"text-sm " + (enabled ? "text-emerald-400" : "text-white/50")}>{enabled ? "Enabled" : "Disabled"}</span>
      </div>
      <form action={savePhotoVaContact} className="space-y-3">
        <input type="hidden" name="teamMemberId" value={teamMemberId} />
        <label className="block space-y-2 text-sm">Private delivery email
          <input name="email" type="email" required defaultValue={email} maxLength={254} autoComplete="off" className={field} />
        </label>
        <div className={enabled ? "grid gap-2 sm:grid-cols-[repeat(2,minmax(0,10rem))]" : ""}>
          <button name="intent" value="enable" className="admin-btn-primary min-h-11">{enabled ? "Save address" : "Enable contact"}</button>
          {enabled && <button name="intent" value="disable" formNoValidate className="admin-btn-secondary min-h-11">Disable contact</button>}
        </div>
      </form>
    </section>)}
    {!candidates.length && !contacts.length && <p className="text-sm text-white/55">Add a Team profile before assigning a photo VA contact.</p>}
  </main>;
}
