import { Fragment, type ReactNode } from "react";

import { splitRich } from "./translate";

/**
 * Places React nodes into a translated string at {name} markers left unfilled
 * by the translator, e.g. "Quoted at {time}." with { time: <Timestamp /> }.
 */
export function fill(message: string, nodes: Record<string, ReactNode>): ReactNode {
  return message.split(/\{(\w+)\}/).map((part, index) =>
    index % 2 === 1 ? (
      <Fragment key={index}>{part in nodes ? nodes[part] : `{${part}}`}</Fragment>
    ) : (
      part
    ),
  );
}

/** Wraps <tag>text</tag> parts of a translated string with the given renderers. */
export function rich(
  message: string,
  tags: Record<string, (text: string) => ReactNode>,
): ReactNode {
  return splitRich(message).map((segment, index) => (
    <Fragment key={index}>
      {segment.tag && tags[segment.tag] ? tags[segment.tag](segment.text) : segment.text}
    </Fragment>
  ));
}
