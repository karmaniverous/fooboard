/**
 * The General tab's *requests in flight* settings (spec.md §3.2, Decisions
 * 10 and 28): for each platform, how many requests each of the
 * dashboard's credentials may have running at once, per tab. A change
 * applies at once and refetches nothing.
 *
 * @module
 */
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  clampRequestsInFlight,
  REQUESTS_IN_FLIGHT_MAX,
  REQUESTS_IN_FLIGHT_MIN,
} from '@/domain/config/settings';

/** Each platform's field label. */
const LABELS: Record<CredentialKind, string> = {
  github: 'GitHub requests in flight',
  aws: 'AWS requests in flight',
};

/** One platform's setting: a number field that commits on blur or Enter,
 * held to the allowed range. */
function Field({
  kind,
  value,
  describedBy,
  onCommit,
}: {
  kind: CredentialKind;
  value: number;
  describedBy: string;
  onCommit: (value: number) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(String(value));
  }
  const commit = () => {
    // An empty field (or one the browser couldn't read as a number)
    // keeps the value rather than reading as 0.
    const parsed = draft.trim() === '' ? NaN : Number(draft);
    const next = Number.isFinite(parsed)
      ? clampRequestsInFlight(parsed)
      : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="flex items-center gap-2">
      <span className="w-48 text-xs">{LABELS[kind]}</span>
      <Input
        type="number"
        className="h-8 w-20 text-xs"
        aria-label={LABELS[kind]}
        aria-describedby={describedBy}
        min={REQUESTS_IN_FLIGHT_MIN}
        max={REQUESTS_IN_FLIGHT_MAX}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
    </label>
  );
}

export function RequestsInFlight({
  dashboard,
  onChange,
}: {
  dashboard: Dashboard;
  onChange: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const hint = useId();
  const { requestsInFlight } = dashboard.settings;
  const set = (kind: CredentialKind, value: number) => {
    onChange({
      ...dashboard,
      settings: {
        ...dashboard.settings,
        requestsInFlight: { ...requestsInFlight, [kind]: value },
      },
    });
  };
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-xs text-muted-foreground">
        Requests in flight
      </legend>
      {(['github', 'aws'] as const).map((kind) => (
        <Field
          key={kind}
          kind={kind}
          value={requestsInFlight[kind]}
          describedBy={hint}
          onCommit={(value) => {
            set(kind, value);
          }}
        />
      ))}
      <p id={hint} className="text-xs text-muted-foreground">
        How many requests each credential may have running at once, from{' '}
        {REQUESTS_IN_FLIGHT_MIN} to {REQUESTS_IN_FLIGHT_MAX}, in each tab.
        Higher fills the board faster; bursts can trigger the provider&apos;s
        secondary limits or throttling, after which fooboard pauses that
        credential until the provider says to retry. 1 sends one request at a
        time.
      </p>
    </fieldset>
  );
}
