"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

export type ProjectAgentDraft = { id?: string; clientId: string | null; displayNameSnapshot: string; brokerageSnapshot: string };
export type AgentClientOption = { id: string; firstName: string; lastName: string; displayName: string; email: string; brokerage: string | null };

import { PROJECT_TYPES } from "@/lib/project-types";

export type ProjectDetailsDraft = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  city: string;
  state: string;
  locationLabel: string;
  projectType: string;
  propertyType: string;
  seoTitle: string;
  seoDescription: string;
  listingAgent: string;
  brokerage: string;
  builder: string;
  architect: string;
  interiorDesigner: string;
  squareFeet: string;
  bedrooms: string;
  bathrooms: string;
  lotSize: string;
  neighborhood: string;
  propertyAddress: string;
  propertyWebsiteUrl: string;
};

type ProjectDetailsEditorProps = {
  projectId: string;
  initialData: ProjectDetailsDraft;
  statusLabel: string;
  initialAgents: ProjectAgentDraft[];
  clientOptions: AgentClientOption[];
};

type ProjectDetailsResponse = {
  success: boolean;
  error?: string;
  project?: {
    id: string;
    title: string;
    slug: string;
  };
};

const inputClasses =
  "mt-2 min-h-12 w-full rounded-xl border border-white/[0.08] bg-black/25 px-4 text-sm text-white outline-none transition placeholder:text-white/18 focus:border-[var(--helios-orange)]/45 focus:bg-black/35";
const labelClasses =
  "text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/35";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function Field({
  label,
  children,
  className = "",
  detail,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  detail?: string;
}) {
  return (
    <label className={className}>
      <span className={labelClasses}>{label}</span>
      {children}
      {detail && (
        <span className="mt-2 block text-xs text-white/22">{detail}</span>
      )}
    </label>
  );
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-white/[0.08] px-5 py-5 sm:px-6">
      <div className="flex items-start gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--helios-orange)]/25 bg-[var(--helios-orange)]/[0.07] text-[0.54rem] font-semibold text-[var(--helios-orange-hover)]">
          {number}
        </span>
        <div>
          <h3 className="text-xl font-normal text-white">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-white/30">{description}</p>
        </div>
      </div>
    </div>
  );
}

function AgentSelector({ clients, agents, onChange, legacyName, legacyBrokerage }: { clients: AgentClientOption[]; agents: ProjectAgentDraft[]; onChange: (agents: ProjectAgentDraft[]) => void; legacyName: string; legacyBrokerage: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualBrokerage, setManualBrokerage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLowerCase();
  const results = clients.filter((client) => !agents.some((agent) => agent.clientId === client.id) && `${client.firstName} ${client.lastName} ${client.displayName} ${client.email} ${client.brokerage || ""}`.toLowerCase().includes(normalized)).slice(0, 20);
  const addClient = (client: AgentClientOption) => {
    onChange([...agents, { clientId: client.id, displayNameSnapshot: client.displayName, brokerageSnapshot: client.brokerage || "" }]);
    setQuery(""); setOpen(false); setActiveIndex(0); inputRef.current?.focus();
  };
  const update = (index: number, field: "displayNameSnapshot" | "brokerageSnapshot", value: string) => onChange(agents.map((agent, agentIndex) => agentIndex === index ? { ...agent, [field]: value } : agent));
  const move = (index: number, direction: -1 | 1) => { const next = [...agents]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onChange(next); };
  return <div>
    <p className={labelClasses}>Agents and brokerages</p>
    {agents.length === 0 && legacyName && <div className="mt-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.04] px-4 py-3"><p className="text-sm text-white/65">Current published credit: {legacyName}{legacyBrokerage ? ` · ${legacyBrokerage}` : ""}</p><p className="mt-1 text-xs text-white/30">Preserved as entered. Connect it manually only when you are ready.</p></div>}
    <div className="relative mt-3">
      <label className="sr-only" htmlFor="agent-client-search">Search existing clients</label>
      <input ref={inputRef} id="agent-client-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="agent-client-results" aria-activedescendant={open && results[activeIndex] ? `agent-client-${results[activeIndex].id}` : undefined} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1))); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); } else if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); addClient(results[activeIndex]); } else if (event.key === "Escape") setOpen(false); }} placeholder="Search name, email, or brokerage" className={inputClasses} />
      {open && <div id="agent-client-results" role="listbox" className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-[#171718] p-1 shadow-2xl">{results.map((client, index) => <button id={`agent-client-${client.id}`} role="option" aria-selected={index === activeIndex} key={client.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addClient(client)} className={`block w-full rounded-lg px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--helios-orange)] ${index === activeIndex ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"}`}><span className="block text-sm text-white/75">{client.displayName}</span><span className="mt-1 block text-xs text-white/35">{[client.brokerage, client.email].filter(Boolean).join(" · ")}</span></button>)}{results.length === 0 && <p className="px-3 py-4 text-sm text-white/35">No matching clients.</p>}</div>}
    </div>
    <button type="button" onClick={() => setManual((value) => !value)} className="admin-btn-link mt-3">Enter agent manually</button>
    {manual && <div className="mt-3 grid gap-3 rounded-xl border border-white/[0.08] p-4 sm:grid-cols-2"><Field label="Agent display name"><input value={manualName} onChange={(event) => setManualName(event.target.value)} maxLength={160} className={inputClasses} /></Field><Field label="Brokerage"><input value={manualBrokerage} onChange={(event) => setManualBrokerage(event.target.value)} maxLength={160} className={inputClasses} /></Field><div className="sm:col-span-2"><button type="button" disabled={!manualName.trim()} onClick={() => { onChange([...agents, { clientId: null, displayNameSnapshot: manualName.trim(), brokerageSnapshot: manualBrokerage.trim() }]); setManualName(""); setManualBrokerage(""); setManual(false); }} className="admin-btn-secondary">Add manual agent</button></div></div>}
    <div className="mt-4 space-y-3">{agents.map((agent, index) => <div key={agent.id || `${agent.clientId || "manual"}-${index}`} className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Field label="Display name"><input value={agent.displayNameSnapshot} onChange={(event) => update(index, "displayNameSnapshot", event.target.value)} maxLength={160} className={inputClasses} /></Field><Field label="Brokerage override"><input value={agent.brokerageSnapshot} onChange={(event) => update(index, "brokerageSnapshot", event.target.value)} maxLength={160} className={inputClasses} /></Field><div className="flex items-end gap-1"><button type="button" aria-label={`Move ${agent.displayNameSnapshot} up`} disabled={index === 0} onClick={() => move(index, -1)} className="admin-btn-link min-h-11 min-w-11">↑</button><button type="button" aria-label={`Move ${agent.displayNameSnapshot} down`} disabled={index === agents.length - 1} onClick={() => move(index, 1)} className="admin-btn-link min-h-11 min-w-11">↓</button><button type="button" aria-label={`Remove ${agent.displayNameSnapshot}`} onClick={() => onChange(agents.filter((_, agentIndex) => agentIndex !== index))} className="admin-btn-link min-h-11">Remove</button></div></div>{agent.clientId && <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-white/25">Client linked. These are project snapshots and will not change automatically.</p><button type="button" onClick={() => { const client = clients.find((item) => item.id === agent.clientId); if (client) onChange(agents.map((item, agentIndex) => agentIndex === index ? { ...item, displayNameSnapshot: client.displayName, brokerageSnapshot: client.brokerage || "" } : item)); }} className="admin-btn-link">Refresh from client record</button></div>}</div>)}</div>
  </div>;
}

export default function ProjectDetailsEditor({
  projectId,
  initialData,
  statusLabel,
  initialAgents,
  clientOptions,
}: ProjectDetailsEditorProps) {
  const router = useRouter();
  const [savedData, setSavedData] = useState(initialData);
  const [draft, setDraft] = useState(initialData);
  const [savedAgents, setSavedAgents] = useState(initialAgents);
  const [draftAgents, setDraftAgents] = useState(initialAgents);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedData) || JSON.stringify(draftAgents) !== JSON.stringify(savedAgents),
    [draft, draftAgents, savedData, savedAgents],
  );
  const location =
    savedData.locationLabel ||
    [savedData.city, savedData.state].filter(Boolean).join(", ");
  const storyReady = Boolean(
    savedData.shortDescription && savedData.description,
  );
  const seoReady = Boolean(savedData.seoTitle && savedData.seoDescription);

  const updateField = useCallback(
    (field: keyof ProjectDetailsDraft, value: string) => {
      setDraft((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const closeEditor = useCallback(() => {
    if (
      isDirty &&
      !window.confirm("Discard the unsaved project detail changes?")
    ) {
      return;
    }

    setDraft(savedData);
    setDraftAgents(savedAgents);
    setError(null);
    setIsOpen(false);
  }, [isDirty, savedAgents, savedData]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        closeEditor();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeEditor, isOpen, isSaving]);

  const saveDetails = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      try {
        setIsSaving(true);
        setError(null);

        const response = await fetch(
          `/api/admin/projects/${projectId}/details`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...draft, agents: draftAgents }),
          },
        );
        const data = (await response.json()) as ProjectDetailsResponse;

        if (!response.ok || !data.success || !data.project) {
          throw new Error(
            data.error || "The project details could not be saved.",
          );
        }

        const nextData = {
          ...draft,
          title: data.project.title,
          slug: data.project.slug,
        };

        setDraft(nextData);
        setSavedData(nextData);
        setSavedAgents(draftAgents);
        setIsOpen(false);
        router.refresh();
      } catch (saveError) {
        console.error("Unable to save project details:", saveError);
        setError(
          saveError instanceof Error
            ? saveError.message
            : "The project details could not be saved.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [draft, draftAgents, projectId, router],
  );

  return (
    <>
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
              Step 01
            </p>
            <h2 className="mt-3 text-2xl font-normal text-white">
              Project details
            </h2>
            <p className="mt-1 text-sm text-white/35">
              Identity, story, property facts, credits, and search metadata.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDraft(savedData);
              setDraftAgents(savedAgents);
              setError(null);
              setIsOpen(true);
            }}
            className="admin-btn-secondary"
          >
            Edit project details
          </button>
        </div>

        <dl className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-3">
          {[
            ["Title", savedData.title],
            ["Location", location || "Not specified"],
            ["Internal address", savedData.propertyAddress || "Not specified"],
            ["Project type", savedData.projectType || "Not specified"],
            ["Property type", savedData.propertyType || "Not specified"],
            ["Project story", storyReady ? "Complete" : "Needs content"],
            ["Search preview", seoReady ? "Customized" : "Uses defaults"],
            ["Status", statusLabel],
            ["Portfolio URL", `/portfolio/${savedData.slug}`],
            [
              "Property facts",
              savedData.squareFeet || savedData.bedrooms || savedData.bathrooms
                ? "Added"
                : "Not provided",
            ],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0c0c0d] px-5 py-5 sm:px-6">
              <dt className="text-[0.58rem] font-semibold uppercase tracking-[0.17em] text-white/23">
                {label}
              </dt>
              <dd className="mt-2 truncate text-sm leading-6 text-white/62">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-details-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-black/88 p-3 backdrop-blur-xl sm:p-6"
        >
          <div className="mx-auto my-3 max-w-6xl overflow-hidden rounded-3xl border border-white/[0.1] bg-[#101011] shadow-[0_40px_120px_rgba(0,0,0,0.75)] sm:my-8">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-5 border-b border-white/[0.08] bg-[#101011]/95 px-5 py-5 backdrop-blur-xl sm:px-7">
              <div>
                <p className="text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[var(--helios-orange)]">
                  Project configuration
                </p>
                <h2
                  id="project-details-title"
                  className="mt-2 text-2xl font-normal text-white sm:text-3xl"
                >
                  Edit project details
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                aria-label="Close project details editor"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-35"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                >
                  <path
                    d="m6 6 12 12M18 6 6 18"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={(event) => void saveDetails(event)}>
              <div className="space-y-5 p-4 sm:p-6">
                {error && (
                  <div
                    role="alert"
                    className="rounded-2xl border border-red-300/15 bg-red-300/[0.06] px-5 py-4 text-sm text-red-200/80"
                  >
                    {error}
                  </div>
                )}

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="01"
                    title="Identity and location"
                    description="Control the public project name, URL, and geographic context."
                  />
                  <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                    <Field
                      label="Property address — internal only"
                      className="sm:col-span-2"
                      detail="Used only to find this project in Admin. It is never displayed publicly."
                    >
                      <input
                        value={draft.propertyAddress}
                        onChange={(event) =>
                          updateField("propertyAddress", event.target.value)
                        }
                        maxLength={300}
                        autoComplete="street-address"
                        placeholder="3095 Gladstone Avenue, Loveland, CO 80538"
                        className={inputClasses}
                      />
                    </Field>

                    <Field label="Project title">
                      <input
                        required
                        autoFocus
                        value={draft.title}
                        onChange={(event) =>
                          updateField("title", event.target.value)
                        }
                        maxLength={120}
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="Portfolio URL"
                      detail="Changing this updates the public project address."
                    >
                      <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-white/[0.08] bg-black/25 transition focus-within:border-[var(--helios-orange)]/45">
                        <span className="flex items-center border-r border-white/[0.08] px-3 text-xs text-white/22">
                          /portfolio/
                        </span>
                        <input
                          required
                          value={draft.slug}
                          onChange={(event) =>
                            updateField("slug", slugify(event.target.value))
                          }
                          maxLength={140}
                          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none"
                        />
                      </div>
                    </Field>

                    <Field label="City">
                      <input
                        value={draft.city}
                        onChange={(event) =>
                          updateField("city", event.target.value)
                        }
                        maxLength={120}
                        placeholder="Fort Collins"
                        className={inputClasses}
                      />
                    </Field>

                    <Field label="State">
                      <input
                        value={draft.state}
                        onChange={(event) =>
                          updateField("state", event.target.value)
                        }
                        maxLength={120}
                        placeholder="Colorado"
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="Display location"
                      className="sm:col-span-2"
                      detail="Optional. Replaces city and state in public experiences."
                    >
                      <input
                        value={draft.locationLabel}
                        onChange={(event) =>
                          updateField("locationLabel", event.target.value)
                        }
                        maxLength={180}
                        placeholder="Old Town Fort Collins, Colorado"
                        className={inputClasses}
                      />
                    </Field>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="02"
                    title="Portfolio story"
                    description="Shape the concise preview and long-form public project narrative."
                  />
                  <div className="grid gap-5 p-5 sm:p-6">
                    <Field
                      label="Short description"
                      detail={`${draft.shortDescription.length}/320 characters · recommended, optional for video-led projects`}
                    >
                      <textarea
                        value={draft.shortDescription}
                        onChange={(event) =>
                          updateField("shortDescription", event.target.value)
                        }
                        maxLength={320}
                        rows={3}
                        placeholder="A concise introduction for portfolio previews."
                        className={`${inputClasses} resize-y py-3`}
                      />
                    </Field>

                    <Field
                      label="Project narrative"
                      detail={`${draft.description.length}/6000 characters`}
                    >
                      <textarea
                        value={draft.description}
                        onChange={(event) =>
                          updateField("description", event.target.value)
                        }
                        maxLength={6000}
                        rows={7}
                        placeholder="Tell the story of the property, creative approach, and final presentation."
                        className={`${inputClasses} resize-y py-3 leading-7`}
                      />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Project type">
                        <select
                          value={draft.projectType}
                          onChange={(event) =>
                            updateField("projectType", event.target.value)
                          }
                          className={inputClasses}
                        >
                          <option value="">Select project type</option>
                          {PROJECT_TYPES.map((projectType) => (
                            <option key={projectType} value={projectType}>
                              {projectType}
                            </option>
                          ))}
                          {draft.projectType &&
                          !PROJECT_TYPES.includes(
                            draft.projectType as (typeof PROJECT_TYPES)[number],
                          ) ? (
                            <option value={draft.projectType}>
                              {draft.projectType}
                            </option>
                          ) : null}
                        </select>
                      </Field>

                      <Field label="Property type">
                        <input
                          value={draft.propertyType}
                          onChange={(event) =>
                            updateField("propertyType", event.target.value)
                          }
                          maxLength={120}
                          placeholder="Luxury Home"
                          className={inputClasses}
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="03"
                    title="Property facts"
                    description="Add useful property context without coupling the portfolio to listing data."
                  />
                  <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
                    {[
                      ["Square feet", "squareFeet", "4200", "1"],
                      ["Bedrooms", "bedrooms", "4", "0.5"],
                      ["Bathrooms", "bathrooms", "3.5", "0.5"],
                    ].map(([label, field, placeholder, step]) => (
                      <Field key={field} label={label}>
                        <input
                          type="number"
                          min="0"
                          step={step}
                          value={draft[field as keyof ProjectDetailsDraft]}
                          onChange={(event) =>
                            updateField(
                              field as keyof ProjectDetailsDraft,
                              event.target.value,
                            )
                          }
                          placeholder={placeholder}
                          className={inputClasses}
                        />
                      </Field>
                    ))}

                    <Field label="Lot size">
                      <input
                        value={draft.lotSize}
                        onChange={(event) =>
                          updateField("lotSize", event.target.value)
                        }
                        maxLength={120}
                        placeholder="0.34 acres"
                        className={inputClasses}
                      />
                    </Field>

                    <Field label="Neighborhood">
                      <input
                        value={draft.neighborhood}
                        onChange={(event) =>
                          updateField("neighborhood", event.target.value)
                        }
                        maxLength={160}
                        placeholder="Old Town"
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="Property website"
                      className="sm:col-span-2 lg:col-span-3"
                    >
                      <input
                        type="url"
                        value={draft.propertyWebsiteUrl}
                        onChange={(event) =>
                          updateField("propertyWebsiteUrl", event.target.value)
                        }
                        maxLength={500}
                        placeholder="https://property.example.com"
                        className={inputClasses}
                      />
                    </Field>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="04"
                    title="Project credits"
                    description="Recognize the people and teams behind the property and campaign."
                  />
                  <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <AgentSelector clients={clientOptions} agents={draftAgents} onChange={setDraftAgents} legacyName={draft.listingAgent} legacyBrokerage={draft.brokerage} />
                    </div>
                    {[
                      ["Builder", "builder"],
                      ["Architect", "architect"],
                      ["Interior designer", "interiorDesigner"],
                    ].map(([label, field]) => (
                      <Field key={field} label={label}>
                        <input
                          value={draft[field as keyof ProjectDetailsDraft]}
                          onChange={(event) =>
                            updateField(
                              field as keyof ProjectDetailsDraft,
                              event.target.value,
                            )
                          }
                          maxLength={160}
                          className={inputClasses}
                        />
                      </Field>
                    ))}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
                  <SectionHeading
                    number="05"
                    title="Search and sharing"
                    description="Customize browser and social previews; blank fields use project defaults."
                  />
                  <div className="grid gap-5 p-5 sm:p-6">
                    <Field
                      label="SEO title"
                      detail={`${draft.seoTitle.length}/70 characters`}
                    >
                      <input
                        value={draft.seoTitle}
                        onChange={(event) =>
                          updateField("seoTitle", event.target.value)
                        }
                        maxLength={70}
                        placeholder={`${draft.title} | Helios Real Estate Media`}
                        className={inputClasses}
                      />
                    </Field>

                    <Field
                      label="SEO description"
                      detail={`${draft.seoDescription.length}/180 characters`}
                    >
                      <textarea
                        value={draft.seoDescription}
                        onChange={(event) =>
                          updateField("seoDescription", event.target.value)
                        }
                        maxLength={180}
                        rows={3}
                        placeholder={
                          draft.shortDescription ||
                          "A concise search and social description."
                        }
                        className={`${inputClasses} resize-y py-3`}
                      />
                    </Field>
                  </div>
                </section>
              </div>

              <div className="sticky bottom-0 flex flex-col gap-4 border-t border-white/[0.08] bg-[#101011]/95 px-5 py-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="text-xs text-white/25">
                  {isDirty ? "Unsaved changes" : "All changes saved"}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={isSaving}
                    className="admin-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSaving || !isDirty || !draft.title || !draft.slug
                    }
                    className="admin-btn-primary"
                  >
                    {isSaving && (
                      <span className="h-3 w-3 animate-spin rounded-full border border-black/25 border-t-black" />
                    )}
                    {isSaving ? "Saving details" : "Save project"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
