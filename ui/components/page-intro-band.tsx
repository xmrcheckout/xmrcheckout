import type { ElementType, ReactNode } from "react";

export type PageIntroFact = {
  label: string;
  value: ReactNode;
};

type PageIntroBandProps = {
  as?: "h1" | "p";
  compact?: boolean;
  description: ReactNode;
  eyebrow: string;
  facts?: PageIntroFact[];
  id?: string;
  title: ReactNode;
  tone?: "ink" | "light";
};

export default function PageIntroBand({
  as = "h1",
  compact = false,
  description,
  eyebrow,
  id,
  title,
}: PageIntroBandProps) {
  const Title = as as ElementType;

  return (
    <header
      className={`${compact ? "pb-4" : "pb-5"} border-b border-stroke`}
      aria-labelledby={as === "h1" ? id : undefined}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-clay" aria-hidden="true" />
        {eyebrow}
      </p>
      <Title
        className={`${compact ? "mt-1 text-2xl" : "mt-1 text-2xl sm:text-3xl"} max-w-4xl font-sans font-semibold leading-tight`}
        id={id}
      >
        {title}
      </Title>
      <div className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
        {description}
      </div>
    </header>
  );
}
