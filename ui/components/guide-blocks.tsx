import { Fragment, type ReactNode } from "react";

import { rich } from "../lib/i18n/rich";
import type { Translate } from "../lib/i18n/translate";

/**
 * Prose blocks for guide and documentation pages. Text comes from the message
 * catalog: the nth text block of a section is `${prefix}.${n}`, and list items
 * are `${prefix}.${n}.${item}`. "node" blocks (code samples, tables) render as
 * given and are not numbered.
 */
export type GuideBlock =
  | { kind: "p" | "h3"; className?: string }
  | { kind: "ol" | "ul"; items: number; className?: string }
  | { kind: "node"; node: ReactNode };

export type RichTags = Record<string, (text: string) => ReactNode>;

const defaults = {
  p: "mt-3",
  h3: "mt-6 font-sans text-lg font-semibold",
  ol: "mt-4 list-decimal space-y-3 pl-5",
  ul: "mt-4 list-disc space-y-3 pl-5",
};

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

export function GuideBlocks({
  blocks,
  prefix,
  t,
  tags,
}: {
  blocks: GuideBlock[];
  prefix: string;
  t: Translate;
  tags: RichTags;
}) {
  // Text blocks are numbered in order; node blocks are skipped.
  const numbers = blocks.reduce<number[]>(
    (acc, block) => [...acc, (acc.at(-1) ?? 0) + (block.kind === "node" ? 0 : 1)],
    [],
  );
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "node") return <Fragment key={`node-${index}`}>{block.node}</Fragment>;
        const key = `${prefix}.${numbers[index]}`;
        const className = block.className ?? defaults[block.kind];
        if (block.kind === "p" || block.kind === "h3") {
          const Text = block.kind;
          return <Text key={key} className={className}>{rich(t(key), tags)}</Text>;
        }
        const List = block.kind;
        const items = "items" in block ? block.items : 0;
        return (
          <List key={key} className={className}>
            {range(items).map((item) => (
              <li key={item}>{rich(t(`${key}.${item}`), tags)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
