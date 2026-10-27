/**
 * What's new (spec.md C-20, §3.10): the bundled changelog in a side panel
 * whose header stays pinned (a first release lists every change, so the
 * body is long), a collapsed entry per release (Decision 44 item 3),
 * newest first and open, one open at a time; each entry's changes by
 * kind, and its post on X when it has one. Opened from the menu, which
 * marks the newest release seen.
 *
 * @module
 */
import { useState } from 'react';

import { CollapsibleItem } from '@/components/CollapsibleItem';
import { ExternalLink } from '@/components/ExternalLink';
import { PanelSheetContent } from '@/components/SidePanel';
import { Sheet } from '@/components/ui/sheet';

import type { Release } from './changelog';
import { InlineMarkdown } from './InlineMarkdown';

function ReleaseBody({ release }: { release: Release }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 px-1 text-sm">
      {release.sections.map((s) => (
        <section key={s.title} aria-label={s.title}>
          <h3 className="font-medium">{s.title}</h3>
          <ul className="ml-5 list-disc text-muted-foreground">
            {s.items.map((item, i) => (
              // Changelog lines can repeat; their order is fixed.
              <li key={`${String(i)}:${item}`}>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {release.xPost !== undefined && (
        <ExternalLink href={release.xPost} className="self-start">
          {`The ${release.version} post on X`}
        </ExternalLink>
      )}
    </div>
  );
}

export function WhatsNewDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  releases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when it closes (it has no trigger of its own). */
  onCloseAutoFocus?: (e: Event) => void;
  /** Newest first. */
  releases: readonly Release[];
}): React.JSX.Element {
  // The newest starts open; opening one closes the others.
  const [expanded, setExpanded] = useState(releases.at(0)?.version);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <PanelSheetContent
        side="right"
        title="What's new"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {releases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No releases yet: this build is ahead of the first one.
          </p>
        ) : (
          releases.map((r) => (
            <CollapsibleItem
              key={r.version}
              name={r.version}
              summary={r.date}
              label={`Release ${r.version}`}
              open={expanded === r.version}
              onOpenChange={(next) => {
                setExpanded(next ? r.version : undefined);
              }}
            >
              <ReleaseBody release={r} />
            </CollapsibleItem>
          ))
        )}
      </PanelSheetContent>
    </Sheet>
  );
}
