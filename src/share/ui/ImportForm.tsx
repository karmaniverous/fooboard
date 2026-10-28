/**
 * The import dialog's form (spec.md §3.8): the share's dashboards (all
 * selected), each one whose id is already here offering *Replace* or
 * *Keep as a copy*; *Add to my dashboards* or *Replace the whole setup*;
 * and, when the share carries credentials, whether to import them, the
 * passphrase for encrypted ones (asked here, after the dashboards are
 * chosen and before *Import*, never on load), *Remember on this device*
 * and a question for each credential whose secret differs from this
 * device's (`SecretQuestions`).
 *
 * @module
 */
import { useId } from 'react';

import { CheckField } from '@/components/CheckField';
import { Choice } from '@/components/Choice';
import { SecretInput } from '@/components/SecretInput';
import type { Dashboard } from '@/domain/config/dashboard';

import type { ImportMode, SameIdChoice } from '../importPlan';
import { DashboardChecklist } from './DashboardChecklist';
import { SecretQuestions } from './SecretQuestions';
import { REMEMBER_NOTE, REPLACE_MINE_NOTE, TAB_ONLY_NOTE } from './shareWords';
import type { ImportForm as Form } from './useImportForm';

const MODES = [
  { value: 'add', label: 'Add to my dashboards' },
  { value: 'replaceAll', label: 'Replace the whole setup' },
] as const satisfies readonly { value: ImportMode; label: string }[];

const SAME_ID = [
  { value: 'replace', label: 'Replace mine' },
  { value: 'copy', label: 'Keep as a copy' },
] as const satisfies readonly { value: SameIdChoice; label: string }[];

export function ImportForm({
  form,
  dashboards,
}: {
  form: Form;
  dashboards: readonly Dashboard[];
}): React.JSX.Element {
  const replaceHint = useId();
  const replacing = dashboards.some(
    (d) =>
      form.selected.has(d.id) &&
      form.clashes(d.id) &&
      form.sameIdOf(d.id) === 'replace',
  );
  return (
    <div className="flex flex-col gap-3">
      <DashboardChecklist
        label="Dashboards to import"
        dashboards={dashboards}
        selected={form.selected}
        onSelectedChange={form.setSelected}
        extra={(d) =>
          form.clashes(d.id) && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Already here:
              <Choice
                label={`${d.name}: already here`}
                value={form.sameIdOf(d.id)}
                options={SAME_ID}
                onValueChange={(choice) => {
                  form.setSameId(d.id, choice);
                }}
                describedBy={replacing ? replaceHint : undefined}
                className="h-8 text-xs"
              />
            </span>
          )
        }
      />
      {replacing && (
        <p id={replaceHint} className="text-xs text-muted-foreground">
          {REPLACE_MINE_NOTE}
        </p>
      )}
      <Choice
        label="How to import"
        value={form.mode}
        options={MODES}
        onValueChange={form.setMode}
      />
      {form.mode === 'replaceAll' && (
        <p className="text-xs text-muted-foreground">
          Every dashboard here that isn&apos;t imported is removed, with its
          credentials. You&apos;ll be asked to confirm.
        </p>
      )}
      {form.carried && (
        <div className="flex flex-col gap-1.5">
          <CheckField
            label="Import its credentials"
            checked={form.withCredentials}
            onCheckedChange={form.setWithCredentials}
            className="text-sm"
          />
          {form.asksPassphrase && (
            <SecretInput
              aria-label="Passphrase"
              placeholder="Passphrase"
              value={form.passphrase}
              onChange={(e) => {
                form.setPassphrase(e.target.value);
              }}
            />
          )}
          {form.withCredentials && (
            <CheckField
              label="Remember on this device"
              checked={form.remember}
              onCheckedChange={form.setRemember}
              className="text-sm"
            />
          )}
          <p className="text-xs text-muted-foreground">
            {form.withCredentials
              ? form.remember
                ? REMEMBER_NOTE
                : TAB_ONLY_NOTE
              : 'Without credentials, rows show Needs credential until you add them.'}
          </p>
        </div>
      )}
      <SecretQuestions form={form} />
      {form.error && (
        <p role="alert" className="text-sm text-status-failure">
          {form.error}
        </p>
      )}
    </div>
  );
}
