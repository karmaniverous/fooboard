/**
 * The General tab's *requests in flight* settings (spec.md §3.2, Decisions
 * 10 and 28): for each platform, how many requests each of the
 * dashboard's credentials may have running at once, per tab. A change
 * applies at once and refetches nothing.
 *
 * @module
 */
import { useId } from 'react';

import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  clampRequestsInFlight,
  REQUESTS_IN_FLIGHT_MAX,
  REQUESTS_IN_FLIGHT_MIN,
} from '@/domain/config/settings';

import { NumberSetting } from './NumberSetting';

/** Each platform's field label. */
const LABELS: Record<CredentialKind, string> = {
  github: 'GitHub requests in flight',
  aws: 'AWS requests in flight',
};

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
        <NumberSetting
          key={kind}
          label={LABELS[kind]}
          value={requestsInFlight[kind]}
          min={REQUESTS_IN_FLIGHT_MIN}
          max={REQUESTS_IN_FLIGHT_MAX}
          hold={clampRequestsInFlight}
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
