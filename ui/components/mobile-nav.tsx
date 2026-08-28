"use client";

import type { ReactNode } from "react";
import type { MouseEvent } from "react";
import { useState } from "react";

type MobileNavProps = {
  children: ReactNode;
};

export default function MobileNav({ children }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    setOpen((current) => !current);
  };

  return (
    <details className="mobile-nav" open={open}>
      <summary
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
      >
        {children}
      </nav>
    </details>
  );
}
