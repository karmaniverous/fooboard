/**
 * A row header's tooltip: the row's name and the GitHub repo it reads or
 * builds from; the name alone for an Amplify app without a GitHub repo
 * (Decision 21). Pure.
 *
 * @module
 */
import type { Row } from '@/domain/config/row';

export const rowLabel = (row: Pick<Row, 'displayName' | 'repo'>): string =>
  row.repo === undefined ? row.displayName : `${row.displayName} (${row.repo})`;
