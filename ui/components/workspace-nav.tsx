import Link from "next/link";

export type WorkspaceNavItem = {
  value: string;
  href: string;
  index: string;
  label: string;
  detail: string;
};

type WorkspaceNavProps = {
  activeValue: string;
  ariaLabel: string;
  items: WorkspaceNavItem[];
  title: string;
  description: string;
  footerTitle: string;
  footerDescription: string;
  mobileColumns?: 2 | 3;
};

export default function WorkspaceNav({
  activeValue,
  ariaLabel,
  items,
  title,
  description,
  footerTitle,
  footerDescription,
  mobileColumns = 3,
}: WorkspaceNavProps) {
  const mobileGridClass =
    mobileColumns === 2 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";

  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <div className="mb-5 hidden border-b border-stroke pb-5 lg:block">
        <p className="font-sans text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-soft">{description}</p>
      </div>
      <nav
        className={`grid gap-2 lg:grid-cols-1 ${mobileGridClass}`}
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const isActive = activeValue === item.value;

          return (
            <Link
              key={item.value}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 ${
                isActive
                  ? "border-ink bg-ink text-cream shadow-[0_8px_18px_rgba(16,18,23,0.14)]"
                  : "border-stroke bg-cream/60 text-ink hover:border-ink/40 hover:bg-white/80"
              }`}
              href={item.href}
            >
              <span
                className={`hidden h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-xs font-semibold sm:grid ${
                  isActive
                    ? "border-cream/25 bg-cream/10 text-cream"
                    : "border-clay/40 bg-clay/10 text-ink"
                }`}
                aria-hidden="true"
              >
                {item.index}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold sm:text-sm">
                  {item.label}
                </span>
                <span
                  className={`mt-0.5 hidden text-xs lg:block ${
                    isActive ? "text-cream/70" : "text-ink-soft/70"
                  }`}
                >
                  {item.detail}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 hidden border-l-2 border-sage pl-4 lg:block">
        <p className="text-sm font-semibold text-ink">{footerTitle}</p>
        <p className="mt-1 text-sm text-ink-soft">{footerDescription}</p>
      </div>
    </aside>
  );
}
