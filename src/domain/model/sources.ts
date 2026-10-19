/**
 * Which source rule a dashboard uses per source (spec.md A§4.3.7):
 * built-ins referenced by id, or the dashboard's own customised copies.
 * A dangling id, or another source's rule, never stops a board loading:
 * the provider's built-in is used and a rule problem reports it (spec.md
 * A§4.3.7). Pure.
 *
 * @module
 */
import { z } from 'zod';

import { BUILTIN_SOURCES } from './builtinSources';
import type { SourceRule } from './sourceRule';

type Provider = SourceRule['provider'];

/** The source rule id per source; defaults to the built-ins. */
export const SourceRefsSchema = z.object({
  github: z.string().min(1).default('github'),
  amplify: z.string().min(1).default('amplify'),
});
type SourceRefs = z.infer<typeof SourceRefsSchema>;

interface SourceScope {
  sourceRules: SourceRefs;
  customSourceRules: readonly SourceRule[];
}

/** Source rule `id`: a built-in, else one of `custom`. */
export const findSourceRule = (
  id: string,
  custom: readonly SourceRule[] = [],
): SourceRule | undefined =>
  BUILTIN_SOURCES.find((s) => s.id === id) ?? custom.find((s) => s.id === id);

const builtinFor = (provider: Provider): SourceRule => {
  const rule = BUILTIN_SOURCES.find((s) => s.provider === provider);
  if (!rule) throw new Error(`no built-in source rule for ${provider}`);
  return rule;
};

/** The source rule `scope` uses for `provider`. */
export function sourceRuleFor(
  scope: SourceScope,
  provider: Provider,
): SourceRule {
  const rule = findSourceRule(
    scope.sourceRules[provider],
    scope.customSourceRules,
  );
  return rule?.provider === provider ? rule : builtinFor(provider);
}

/** Integrity problems with a dashboard's own source rules: ids shadowing
 * a built-in or repeated (references that don't resolve are rule
 * problems, not integrity problems). */
export function sourceRuleReferenceIssues(
  scope: SourceScope,
): { message: string; path: (string | number)[] }[] {
  const issues: { message: string; path: (string | number)[] }[] = [];
  const seen = new Set<string>();
  scope.customSourceRules.forEach((s, i) => {
    const path = ['customSourceRules', i, 'id'];
    if (BUILTIN_SOURCES.some((b) => b.id === s.id))
      issues.push({ message: `source rule id ${s.id} is a built-in's`, path });
    else if (seen.has(s.id))
      issues.push({ message: `duplicate source rule id: ${s.id}`, path });
    seen.add(s.id);
  });
  return issues;
}
