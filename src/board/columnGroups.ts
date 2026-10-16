/**
 * Column grouping for the board header (spec.md C-14b). Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Divider } from '@/domain/config/dividers';

/** Column group segments: each divider starts a segment that runs to the
 * next one, labelled or not, and stages before the first divider form an
 * unlabelled segment. Together they cover every column, so the group strip
 * fills its row and never lets headers auto-place into its gaps. */
export function columnGroups(
  stages: Dashboard['stages'],
  dividers: ReadonlyMap<string, Divider>,
): { label: string; start: number; span: number }[] {
  const groups: { label: string; start: number; span: number }[] = [];
  stages.forEach((stage, i) => {
    const divider = dividers.get(stage.id);
    const current = groups.at(-1);
    if (divider || !current) {
      groups.push({ label: divider?.label ?? '', start: i, span: 1 });
    } else current.span += 1;
  });
  return groups;
}
