import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
};

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
  note,
}: AdminPageHeaderProps) {
  return (
    <header className="border-b border-white/[0.08] pb-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-[var(--helios-orange)]">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">
            {description}
          </p>
        </div>
        {(actions || note) && (
          <div className="flex max-w-xl flex-col gap-3 lg:items-end">
            {note && (
              <div className="max-w-sm text-xs leading-5 text-white/25 lg:text-right">
                {note}
              </div>
            )}
            {actions && <AdminHeaderActions>{actions}</AdminHeaderActions>}
          </div>
        )}
      </div>
    </header>
  );
}

export function AdminHeaderActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function AdminSummaryDashboard({
  children,
  label = "Module summary",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <section aria-label={label} className="admin-summary-dashboard">
      {children}
    </section>
  );
}

export function AdminMainContent({ children }: { children: ReactNode }) {
  return <div className="admin-main-content">{children}</div>;
}

export default function AdminPageLayout({
  header,
  summary,
  children,
  className = "",
}: {
  header: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-page-layout ${className}`.trim()}>
      {header}
      {summary}
      <AdminMainContent>{children}</AdminMainContent>
    </div>
  );
}
