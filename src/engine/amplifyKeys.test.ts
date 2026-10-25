/**
 * Tests for Amplify cells reading with their own AWS key (spec.md
 * §3.11, §3.12): *needs credential* only in the columns whose key is missing or
 * has no secret, one problem naming them whose id survives a change of
 * key, and the pins each key is served by.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { AmplifyRow } from '@/domain/config/row';
import { EMPTY_STATES } from '@/domain/derivation';
import { amplifyCtx as ctx, AWS, rowOf, seedRow } from '@/test/amplifyRows';

import { rowApps } from './amplifyAccess';
import { type AmplifyContext, deriveAmplifyRow } from './amplifyRow';

describe('deriveAmplifyRow per key', () => {
  describe('each cell reading with its own key', () => {
    const [first, ...rest] = demoDashboard.stages;
    const names = rest.map((s) => s.name).join(', ');
    const split =
      (other: string | undefined) => (_row: AmplifyRow, stageId: string) =>
        stageId === first.id ? AWS : other;

    it("keeps a dismissed problem's id until its columns or what is missing change", () => {
      const row = rowOf('marketing-site');
      const idWith = (keyFor: AmplifyContext['keyFor']) =>
        deriveAmplifyRow(
          { ...ctx(new QueryClient()), keyFor, hasReader: (id) => id === AWS },
          row,
        ).problems.map((p) => p.id);
      // Another key without a secret, in the same columns: the same problem.
      expect(idWith(split('locked'))).toEqual(idWith(split('other')));
      // Other columns, or a key missing rather than a secret: a new one.
      expect(idWith(() => 'locked')).not.toEqual(idWith(split('locked')));
      expect(idWith(split(undefined))).not.toEqual(idWith(split('locked')));
    });

    it.each([
      [
        'no secret for their key',
        'locked',
        `${names} need their AWS key's secret, so those cells don't show`,
      ],
      [
        'no key at all',
        undefined,
        `${names} have no AWS key: set one for the row or its columns, so those cells don't show`,
      ],
    ])(
      'shows Needs credential in the columns with %s, naming them in one problem',
      async (_, other, message) => {
        const client = new QueryClient();
        await seedRow(client, 'marketing-site');
        const row = rowOf('marketing-site');
        const keys: AmplifyContext = {
          ...ctx(client),
          keyFor: split(other),
          hasReader: (id) => id === AWS,
        };
        const out = deriveAmplifyRow(keys, row);
        const needsCredential: unknown = expect.objectContaining({
          state: EMPTY_STATES.needsCredential,
        });
        expect(rest.map((s) => out.cells[s.id]?.derivation)).toEqual(
          rest.map(() => needsCredential),
        );
        expect(out.cells[first.id]?.derivation).not.toMatchObject({
          state: EMPTY_STATES.needsCredential,
        });
        expect(out.problems).toEqual([
          expect.objectContaining({
            level: { kind: 'row', id: row.id },
            message,
            dismissable: true,
            target: {
              kind: 'settings',
              place: { level: 'row', rowId: row.id },
              field: 'awsKey',
            },
          }),
        ]);
      },
    );

    it("reads the pins keyed by a cell's key, else the unkeyed ones", () => {
      const row: AmplifyRow = {
        ...rowOf('marketing-site'),
        pinnedApps: [
          { region: 'us-east-1', appId: 'a1', credentialId: AWS },
          { region: 'us-east-1', appId: 'a2', credentialId: 'other' },
          { region: 'us-east-1', appId: 'a3' },
        ],
      };
      const keys: AmplifyContext = {
        ...ctx(new QueryClient()),
        keyFor: split('third'),
      };
      expect(rowApps(keys, row)).toEqual([
        { region: 'us-east-1', appId: 'a1', credentialId: AWS },
        { region: 'us-east-1', appId: 'a3', credentialId: 'third' },
      ]);
    });

    it('reads no app in a cell no pin serves', () => {
      const row: AmplifyRow = {
        ...rowOf('marketing-site'),
        pinnedApps: [
          { region: 'us-east-1', appId: 'a1', credentialId: 'other' },
        ],
      };
      expect(rowApps(ctx(new QueryClient()), row)).toEqual([]);
    });
  });
});
