"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type DetailTab = { id: string; label: string; content: ReactNode };

// Panels stay mounted while hidden, so unsaved form edits survive switching tabs.
export default function DetailTabs({ tabs, labelledBy }: { tabs: DetailTab[]; labelledBy: string }) {
  const prefix = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    if (next === null) return;
    event.preventDefault();
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  };
  return <div className="grid min-w-0 gap-4">
    <div role="tablist" aria-labelledby={labelledBy} className="flex min-w-0 flex-wrap gap-2 border-b border-stroke pb-3">
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return <button key={tab.id} ref={element => { buttons.current[index] = element; }} type="button" role="tab" id={`${prefix}-${tab.id}-tab`} aria-controls={`${prefix}-${tab.id}-panel`} aria-selected={selected} tabIndex={selected ? 0 : -1} onClick={() => setActive(tab.id)} onKeyDown={event => onKeyDown(event, index)}
          className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 focus-visible:ring-offset-2 ${selected ? "border-ink bg-ink text-cream" : "border-stroke text-ink hover:border-ink/30"}`}>{tab.label}</button>;
      })}
    </div>
    {tabs.map(tab => <div key={tab.id} role="tabpanel" id={`${prefix}-${tab.id}-panel`} aria-labelledby={`${prefix}-${tab.id}-tab`} hidden={tab.id !== active} tabIndex={0} className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50">{tab.content}</div>)}
  </div>;
}
