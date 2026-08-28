import type { ElementType, ReactNode } from "react";

type PageIntroBandProps = {
  as?: "h1" | "p";
  description: ReactNode;
  eyebrow: string;
  id?: string;
  title: ReactNode;
};

export default function PageIntroBand({
  as = "h1",
  description,
  eyebrow,
  id,
  title,
}: PageIntroBandProps) {
  const Title = as as ElementType;

  return (
    <header
      className="border-b border-stroke pb-5"
      aria-labelledby={as === "h1" ? id : undefined}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-clay" aria-hidden="true" />
        {eyebrow}
      </p>
      <Title
        className="mt-1 max-w-4xl font-sans text-2xl font-semibold leading-tight sm:text-3xl"
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
