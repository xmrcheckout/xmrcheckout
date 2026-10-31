"use client";

import type { ReactNode } from "react";
import type { MouseEvent } from "react";
import { useRef, useState } from "react";

type MobileNavProps = {
  children: ReactNode;
};

export default function MobileNav({ children }: MobileNavProps) {
  const summaryRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setOpen((current) => !current);
  };

  const handleNavigationClick = (event: MouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return;

    const item = event.target.closest("a[href], button");
    if (item && event.currentTarget.contains(item)) {
      setOpen(false);
    }
  };

  return (
    <details className="mobile-nav" open={open} onKeyDown={(event) => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        summaryRef.current?.focus();
      }
    }}>
      <summary
        ref={summaryRef}
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        onClick={handleSummaryClick}
      >
        Menu
      </summary>
      <nav
        id="mobile-navigation"
        className="mobile-nav-panel"
        aria-label="Mobile navigation"
        onClick={handleNavigationClick}
      >
        {children}
      </nav>
    </details>
  );
}
