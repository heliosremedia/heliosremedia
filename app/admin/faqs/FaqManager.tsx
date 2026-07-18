"use client";

import { useMemo, useState } from "react";

export type AdminFaq = {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  displayOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminFaqCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  faqs: AdminFaq[];
};

type DialogState =
  | { type: "category"; category?: AdminFaqCategory }
  | { type: "faq"; faq?: AdminFaq }
  | null;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function FaqManager({ initialCategories }: { initialCategories: AdminFaqCategory[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [selectedId, setSelectedId] = useState(initialCategories[0]?.id ?? "");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = categories.find((category) => category.id === selectedId) ?? categories[0];
  const totalFaqs = useMemo(() => categories.reduce((sum, category) => sum + category.faqs.length, 0), [categories]);
  const publishedFaqs = useMemo(() => categories.reduce((sum, category) => sum + category.faqs.filter((faq) => faq.published).length, 0), [categories]);

  async function request(url: string, options: RequestInit) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok || data.success !== true) throw new Error(typeof data.error === "string" ? data.error : "The change could not be saved.");
    return data;
  }

  async function saveCategory(formData: FormData) {
    const editing = dialog?.type === "category" ? dialog.category : undefined;
    setBusyId(editing?.id ?? "new-category");
    setError(null);
    try {
      const data = await request("/api/admin/faq-categories", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editing ? { action: "update", categoryId: editing.id } : {}),
          name: formData.get("name"),
          slug: formData.get("slug"),
          description: formData.get("description"),
        }),
      });
      const saved = data.category as Omit<AdminFaqCategory, "faqs"> & { _count?: { faqs: number } };
      setCategories((current) => editing
        ? current.map((category) => category.id === editing.id ? { ...category, ...saved } : category)
        : [...current, { ...saved, faqs: [] }]);
      setSelectedId(saved.id);
      setDialog(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save category."); }
    finally { setBusyId(null); }
  }

  async function saveFaq(formData: FormData) {
    const editing = dialog?.type === "faq" ? dialog.faq : undefined;
    setBusyId(editing?.id ?? "new-faq");
    setError(null);
    try {
      const data = await request("/api/admin/faqs", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editing ? { action: "update", faqId: editing.id } : {}),
          categoryId: formData.get("categoryId"),
          question: formData.get("question"),
          answer: formData.get("answer"),
          published: formData.get("published") === "on",
        }),
      });
      const saved = data.faq as AdminFaq;
      setCategories((current) => current.map((category) => {
        const without = category.faqs.filter((faq) => faq.id !== saved.id);
        return category.id === saved.categoryId ? { ...category, faqs: [...without, saved].sort((a, b) => a.displayOrder - b.displayOrder) } : { ...category, faqs: without };
      }));
      setSelectedId(saved.categoryId);
      setDialog(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save FAQ."); }
    finally { setBusyId(null); }
  }

  async function toggleCategory(category: AdminFaqCategory) {
    setBusyId(category.id); setError(null);
    try {
      const data = await request("/api/admin/faq-categories", { method: "PATCH", body: JSON.stringify({ action: "set-active", categoryId: category.id, active: !category.active }) });
      const saved = data.category as AdminFaqCategory;
      setCategories((current) => current.map((item) => item.id === category.id ? { ...item, ...saved } : item));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update category."); }
    finally { setBusyId(null); }
  }

  async function toggleFaq(faq: AdminFaq) {
    setBusyId(faq.id); setError(null);
    try {
      const data = await request("/api/admin/faqs", { method: "PATCH", body: JSON.stringify({ action: "set-published", faqId: faq.id, published: !faq.published }) });
      const saved = data.faq as AdminFaq;
      setCategories((current) => current.map((category) => ({ ...category, faqs: category.faqs.map((item) => item.id === faq.id ? saved : item) })));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update FAQ."); }
    finally { setBusyId(null); }
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const previous = categories;
    const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCategories(reordered); setBusyId("category-order"); setError(null);
    try { await request("/api/admin/faq-categories", { method: "PATCH", body: JSON.stringify({ action: "reorder", categoryIds: reordered.map(({ id }) => id) }) }); }
    catch (caught) { setCategories(previous); setError(caught instanceof Error ? caught.message : "Unable to save category order."); }
    finally { setBusyId(null); }
  }

  async function moveFaq(index: number, direction: -1 | 1) {
    if (!selected) return;
    const target = index + direction;
    if (target < 0 || target >= selected.faqs.length) return;
    const previous = categories;
    const reordered = [...selected.faqs];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setCategories((current) => current.map((category) => category.id === selected.id ? { ...category, faqs: reordered } : category));
    setBusyId("faq-order"); setError(null);
    try { await request("/api/admin/faqs", { method: "PATCH", body: JSON.stringify({ action: "reorder", categoryId: selected.id, faqIds: reordered.map(({ id }) => id) }) }); }
    catch (caught) { setCategories(previous); setError(caught instanceof Error ? caught.message : "Unable to save FAQ order."); }
    finally { setBusyId(null); }
  }

  async function deleteFaq(faq: AdminFaq) {
    if (!window.confirm(`Permanently delete “${faq.question}”?`)) return;
    setBusyId(faq.id); setError(null);
    try {
      await request(`/api/admin/faqs?faqId=${encodeURIComponent(faq.id)}`, { method: "DELETE" });
      setCategories((current) => current.map((category) => ({ ...category, faqs: category.faqs.filter((item) => item.id !== faq.id) })));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete FAQ."); }
    finally { setBusyId(null); }
  }

  async function deleteCategory(category: AdminFaqCategory) {
    if (!window.confirm(`Permanently delete the “${category.name}” category?`)) return;
    setBusyId(category.id); setError(null);
    try {
      await request(`/api/admin/faq-categories?categoryId=${encodeURIComponent(category.id)}`, { method: "DELETE" });
      const remaining = categories.filter((item) => item.id !== category.id);
      setCategories(remaining); setSelectedId(remaining[0]?.id ?? "");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete category."); }
    finally { setBusyId(null); }
  }

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        {[{ label: "Categories", value: categories.length }, { label: "Total questions", value: totalFaqs }, { label: "Published", value: publishedFaqs }].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.17em] text-white/25">{stat.label}</p>
            <p className="mt-2 text-3xl font-light text-white">{stat.value}</p>
          </div>
        ))}
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200/80">{error}</div>}

      <section className="grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/[0.08] bg-[#111] p-4">
          <div className="flex items-center justify-between gap-3 px-2 py-2">
            <div><p className="text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-white/25">Categories</p><p className="mt-1 text-xs text-white/20">Public grouping and order</p></div>
            <button type="button" onClick={() => setDialog({ type: "category" })} className="rounded-full bg-[var(--helios-orange)] px-4 py-2 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black">Add</button>
          </div>
          <div className="mt-3 space-y-2">
            {categories.map((category, index) => (
              <div key={category.id} className={`rounded-xl border p-3 transition ${selected?.id === category.id ? "border-[var(--helios-orange)]/35 bg-[var(--helios-orange)]/[0.06]" : "border-white/[0.06] bg-white/[0.015]"}`}>
                <button type="button" onClick={() => setSelectedId(category.id)} className="w-full text-left">
                  <span className="flex items-center justify-between gap-3"><span className="text-sm text-white/75">{category.name}</span><span className="text-[0.55rem] text-white/25">{category.faqs.length}</span></span>
                  <span className={`mt-1 block text-[0.5rem] font-semibold uppercase tracking-[0.14em] ${category.active ? "text-emerald-200/55" : "text-white/20"}`}>{category.active ? "Active" : "Inactive"}</span>
                </button>
                <div className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-2">
                  <button type="button" aria-label={`Move ${category.name} up`} disabled={index === 0 || busyId !== null} onClick={() => moveCategory(index, -1)} className="rounded-lg px-2 py-1 text-xs text-white/35 hover:text-white disabled:opacity-20">↑</button>
                  <button type="button" aria-label={`Move ${category.name} down`} disabled={index === categories.length - 1 || busyId !== null} onClick={() => moveCategory(index, 1)} className="rounded-lg px-2 py-1 text-xs text-white/35 hover:text-white disabled:opacity-20">↓</button>
                  <button type="button" onClick={() => setDialog({ type: "category", category })} className="ml-auto px-2 py-1 text-[0.52rem] uppercase tracking-[0.12em] text-white/35 hover:text-white">Edit</button>
                  <button type="button" disabled={busyId !== null} onClick={() => toggleCategory(category)} className="px-2 py-1 text-[0.52rem] uppercase tracking-[0.12em] text-white/35 hover:text-white">{category.active ? "Hide" : "Show"}</button>
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="px-2 py-10 text-center text-sm text-white/25">Create the first category to begin.</p>}
          </div>
        </aside>

        <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
          {selected ? (
            <>
              <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="eyebrow text-[var(--helios-orange)]">{selected.slug}</p><h2 className="mt-2 text-2xl font-light text-white">{selected.name}</h2><p className="mt-2 max-w-xl text-sm text-white/32">{selected.description || "No category description has been added."}</p></div>
                <div className="flex flex-wrap gap-2">
                  {selected.faqs.length === 0 && <button type="button" onClick={() => deleteCategory(selected)} className="rounded-full border border-red-300/15 px-4 py-2 text-[0.52rem] uppercase tracking-[0.14em] text-red-200/45">Delete category</button>}
                  <button type="button" onClick={() => setDialog({ type: "faq" })} className="rounded-full bg-[var(--helios-orange)] px-5 py-2.5 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black">New question</button>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {selected.faqs.map((faq, index) => (
                  <article key={faq.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="flex gap-4">
                      <span className="mt-0.5 text-[0.55rem] font-semibold tracking-[0.15em] text-[var(--helios-orange)]">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="max-w-3xl text-base leading-6 text-white/80">{faq.question}</h3><span className={`rounded-full border px-2.5 py-1 text-[0.49rem] font-semibold uppercase tracking-[0.13em] ${faq.published ? "border-emerald-300/15 text-emerald-200/60" : "border-white/10 text-white/25"}`}>{faq.published ? "Published" : "Draft"}</span></div><p className="mt-3 line-clamp-2 whitespace-pre-line text-sm leading-6 text-white/35">{faq.answer}</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-3">
                      <button type="button" aria-label={`Move question ${index + 1} up`} disabled={index === 0 || busyId !== null} onClick={() => moveFaq(index, -1)} className="rounded-lg px-2 py-1 text-xs text-white/35 hover:text-white disabled:opacity-20">↑</button>
                      <button type="button" aria-label={`Move question ${index + 1} down`} disabled={index === selected.faqs.length - 1 || busyId !== null} onClick={() => moveFaq(index, 1)} className="rounded-lg px-2 py-1 text-xs text-white/35 hover:text-white disabled:opacity-20">↓</button>
                      <button type="button" disabled={busyId !== null} onClick={() => toggleFaq(faq)} className="ml-auto px-3 py-1 text-[0.52rem] uppercase tracking-[0.13em] text-white/35 hover:text-white">{faq.published ? "Unpublish" : "Publish"}</button>
                      <button type="button" onClick={() => setDialog({ type: "faq", faq })} className="px-3 py-1 text-[0.52rem] uppercase tracking-[0.13em] text-white/35 hover:text-white">Edit</button>
                      <button type="button" disabled={busyId !== null} onClick={() => deleteFaq(faq)} className="px-3 py-1 text-[0.52rem] uppercase tracking-[0.13em] text-red-200/40 hover:text-red-200">Delete</button>
                    </div>
                  </article>
                ))}
                {selected.faqs.length === 0 && <div className="py-20 text-center"><p className="font-display text-3xl font-light text-white/35">No questions yet.</p><p className="mt-2 text-sm text-white/20">Add the first answer for this category.</p></div>}
              </div>
            </>
          ) : <div className="py-28 text-center"><p className="font-display text-4xl font-light text-white/30">Your knowledge base starts here.</p><button type="button" onClick={() => setDialog({ type: "category" })} className="mt-6 rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.55rem] font-semibold uppercase tracking-[0.14em] text-black">Create a category</button></div>}
        </div>
      </section>

      {dialog?.type === "category" && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title">
          <form action={saveCategory} className="w-full max-w-xl rounded-2xl border border-white/[0.1] bg-[#151515] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">FAQ taxonomy</p><h2 id="category-dialog-title" className="mt-2 text-2xl font-light text-white">{dialog.category ? "Edit category" : "New category"}</h2></div><button type="button" onClick={() => setDialog(null)} className="h-10 w-10 rounded-full border border-white/10 text-white/40">×</button></div>
            <label className="mt-7 block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Name<input name="name" required maxLength={100} defaultValue={dialog.category?.name} onChange={(event) => { const slug = event.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement | null; if (slug && !dialog.category) slug.value = slugify(event.target.value); }} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            <label className="mt-5 block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">URL slug<input name="slug" required maxLength={120} defaultValue={dialog.category?.slug} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            <label className="mt-5 block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Description<textarea name="description" maxLength={300} rows={3} defaultValue={dialog.category?.description ?? ""} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setDialog(null)} className="rounded-full border border-white/10 px-5 py-3 text-[0.54rem] uppercase tracking-[0.14em] text-white/40">Cancel</button><button type="submit" disabled={busyId !== null} className="rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40">{busyId ? "Saving…" : "Save category"}</button></div>
          </form>
        </div>
      )}

      {dialog?.type === "faq" && selected && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/80 p-5 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="faq-dialog-title">
          <form action={saveFaq} className="my-auto w-full max-w-3xl rounded-2xl border border-white/[0.1] bg-[#151515] p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[var(--helios-orange)]">Customer knowledge</p><h2 id="faq-dialog-title" className="mt-2 text-2xl font-light text-white">{dialog.faq ? "Edit question" : "New question"}</h2></div><button type="button" onClick={() => setDialog(null)} className="h-10 w-10 rounded-full border border-white/10 text-white/40">×</button></div>
            <label className="mt-7 block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Category<select name="categoryId" defaultValue={dialog.faq?.categoryId ?? selected.id} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--helios-orange)]">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label className="mt-5 block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Question<textarea name="question" required maxLength={240} rows={2} defaultValue={dialog.faq?.question} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-6 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            <label className="mt-5 block text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-white/35">Answer<textarea name="answer" required maxLength={5000} rows={8} defaultValue={dialog.faq?.answer} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm normal-case leading-7 tracking-normal text-white outline-none focus:border-[var(--helios-orange)]" /></label>
            {!dialog.faq && <label className="mt-5 flex items-center gap-3 text-sm text-white/45"><input type="checkbox" name="published" className="h-4 w-4 accent-[var(--helios-orange)]" />Publish immediately</label>}
            <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setDialog(null)} className="rounded-full border border-white/10 px-5 py-3 text-[0.54rem] uppercase tracking-[0.14em] text-white/40">Cancel</button><button type="submit" disabled={busyId !== null} className="rounded-full bg-[var(--helios-orange)] px-6 py-3 text-[0.54rem] font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-40">{busyId ? "Saving…" : "Save question"}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
