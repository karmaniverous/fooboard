/**
 * Branch discovery for the editors (spec.md C-21): branch names per repo,
 * read with each row's own GitHub token (row, then row group, then
 * dashboard default, C-1a).
 *
 * @module
 */
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import { rowGroupOf } from '@/domain/config/groups';
import type { Row } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

export async function discoverBranches(
  dashboard: Dashboard,
  providers: EngineProviders,
  rows: readonly Row[] = dashboard.rows,
): Promise<Map<string, string[]>> {
  const byRepo = new Map<string, string[]>();
  for (const row of rows) {
    if (byRepo.has(row.repo)) continue;
    const override =
      row.type === 'github' ? row.credentialId : row.githubCredentialId;
    const id = resolveCredentialId(
      dashboard.defaultCredentials,
      'github',
      override,
      rowGroupOf(dashboard.rowGroups, row.id)?.defaultCredentials,
    );
    const reader = id ? providers.github(id) : undefined;
    if (!reader) continue;
    const [owner = '', repo = ''] = row.repo.split('/');
    const branches = await reader.listBranches({ owner, repo });
    byRepo.set(
      row.repo,
      branches.map((b) => b.name),
    );
  }
  return byRepo;
}
