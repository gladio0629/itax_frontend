import { Fragment, type ReactNode } from "react";

/**
 * A translated template with React nodes in its {{placeholders}} (links,
 * bold parts), so word order stays in the translation:
 * rich(t("auth.legal"), { terms: <a…/>, privacy: <a…/> }).
 */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\{\w+\}\})/g).map((chunk, i) => {
    const m = /^\{\{(\w+)\}\}$/.exec(chunk);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]] : chunk}</Fragment>;
  });
}
