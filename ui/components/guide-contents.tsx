export default function GuideContents({ label, entries }: { label: string; entries: { href: string; label: string }[] }) {
  return <nav aria-label={label} className="mt-6 rounded-surface border border-stroke bg-card p-2 shadow-soft">
    <ol className="grid gap-1.5 sm:grid-cols-2">
      {entries.map((entry, index) => <li key={entry.href} className="min-w-0">
        <a className="flex min-h-11 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-ink-soft transition hover:border-stroke hover:bg-white/70 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50" href={entry.href}>
          <span aria-hidden="true" className="font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
          {entry.label}
        </a>
      </li>)}
    </ol>
  </nav>;
}
