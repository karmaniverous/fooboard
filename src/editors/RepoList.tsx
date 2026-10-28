/**
 * A searchable list of repos (spec.md C-21): a search box over the repo
 * names a token can see, each shown by `children` (a button picking it in
 * the row editor's picker, a checkbox in the first run's repo step).
 *
 * @module
 */
import { useState } from 'react';

import { Input } from '@/components/ui/input';

export function RepoList({
  repos,
  children,
  className = 'max-h-48',
}: {
  /** Full repo names, in the order shown. */
  repos: readonly string[];
  /** One repo's entry. */
  children: (repo: string) => React.ReactNode;
  /** The list's height limit. */
  className?: string;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const shown = repos.filter((r) =>
    r.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Input
        aria-label="Search repos"
        placeholder="Search repos"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
        }}
      />
      <ul className={`${className} overflow-y-auto`}>
        {shown.map((r) => (
          <li key={r}>{children(r)}</li>
        ))}
      </ul>
    </>
  );
}
