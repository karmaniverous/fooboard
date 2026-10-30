/**
 * A dashboard's dismissed unmapped-run patterns travel with it (spec
 * 0.2.0 §3.I *Sharing*): through a share (export, a link or a file, all
 * one envelope, which carries data model v7), an import's *Add* and
 * *Keep as a copy* (their ids kept: unique within their dashboard only),
 * *Replace the whole setup*, and *Duplicate*.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { duplicateDashboard } from '@/editors/edit';

import { buildEnvelope, readShare } from './envelope';
import { planImport } from './importPlan';

const DISMISSALS = [
  { id: 'd1', where: 'acme/api', workflow: 'Nightly' },
  { id: 'd2', branch: 'dependabot/**', reason: 'no-row-matches' as const },
];
const board = DashboardSchema.parse({
  id: 'board',
  name: 'Board',
  unmappedDismissals: DISMISSALS,
});

describe('dismissals travel with their dashboard', () => {
  it('through a share, as data model v7', () => {
    const envelope = buildEnvelope([board], null);
    expect(envelope.schemaVersion).toBe(7);
    const read = readShare(JSON.stringify(envelope));
    if (!read.ok) throw new Error('refused');
    expect(read.share.dashboards[0]?.unmappedDismissals).toEqual(DISMISSALS);
  });

  it('through an import, added, kept as a copy, or replacing the setup', () => {
    const add = planImport(
      [board],
      {
        dashboards: [board],
        mode: 'add',
        sameId: { board: 'copy' },
        secrets: null,
      },
      () => 'copy',
    );
    const copy = add.dashboards.find((d) => d.id === 'copy');
    expect(copy?.unmappedDismissals).toEqual(DISMISSALS);
    const replaced = planImport(
      [DashboardSchema.parse({ id: 'board', name: 'B' })],
      {
        dashboards: [board],
        mode: 'replaceAll',
        sameId: {},
        secrets: null,
      },
    );
    expect(replaced.dashboards[0]?.unmappedDismissals).toEqual(DISMISSALS);
  });

  it('through Duplicate, ids kept', () => {
    const copy = duplicateDashboard(board, 'copy', 'Copy', (id) => id);
    expect(copy.unmappedDismissals).toEqual(DISMISSALS);
  });
});
