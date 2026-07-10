import type { ElementType, ReactNode } from "react";

export type PageIntroFact = {
  label: string;
  value: ReactNode;
};

type PageIntroBandProps = {
  as?: "h1" | "p";
  description: ReactNode;
  eyebrow: string;
  facts?: PageIntroFact[];
  id?: string;
  title: ReactNode;
  tone?: "ink" | "light";
};

export default function PageIntroBand({
  as = "h1",
  description,
  eyebrow,
  facts = [],
  id,
  title,
  tone = "ink",
}: PageIntroBandProps) {
  const Title = as as ElementType;
  const isInk = tone === "ink";

  return (
    <section
      className={`overflow-hidden rounded-surface border shadow-card ${
        isInk
          ? "border-ink bg-ink text-cream"
          : "border-stroke bg-card text-ink"
      }`}
      aria-labelledby={as === "h1" ? id : undefined}
    >
      <div
        className={`grid ${
          facts.length > 0
            ? "lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.65fr)]"
            : ""
        }`}
      >
        <div
          className={`px-5 py-6 sm:px-7 sm:py-7 ${
            facts.length > 0
              ? isInk
                ? "border-b border-cream/20 lg:border-b-0 lg:border-r"
                : "border-b border-stroke lg:border-b-0 lg:border-r"
              : ""
          }`}
        >
          <p
            className={`flex items-center gap-2 text-sm font-semibold ${
              isInk ? "text-cream/75" : "text-ink"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full bg-monero"
              aria-hidden="true"
            />
            {eyebrow}
          </p>
          <Title
            className="mt-2 max-w-4xl font-sans text-[clamp(1.8rem,1.6rem+1vw,2.7rem)] font-semibold leading-tight"
            id={id}
          >
            {title}
          </Title>
          <div
            className={`mt-3 max-w-3xl text-[1rem] leading-relaxed ${
              isInk ? "text-cream/70" : "text-ink-soft"
            }`}
          >
            {description}
          </div>
        </div>
        {facts.length > 0 ? (
          <dl
            className={`grid divide-x ${
              facts.length === 3 ? "grid-cols-3" : "grid-cols-2"
            } ${
              isInk
                ? "divide-cream/20 bg-cream/[0.04]"
                : "divide-stroke bg-sand/40"
            }`}
          >
            {facts.map((fact) => (
              <div
                className="min-w-0 px-3 py-5 sm:px-5 lg:py-7"
                key={fact.label}
              >
                <dt
                  className={`text-xs font-semibold ${
                    isInk ? "text-cream/60" : "text-ink-soft"
                  }`}
                >
                  {fact.label}
                </dt>
                <dd className="mt-1 break-words text-sm font-semibold sm:text-base">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
