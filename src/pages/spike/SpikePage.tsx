/**
 * SpikePage: the shared shell of the removable dev spike pages (spec.md
 * §6). Renders a credential form from a field list, validates it with the
 * page's Zod schema, runs the page's call chain, and shows the result or
 * the error verbatim. Each spike page supplies only its fields, schema,
 * call chain and an optional result header.
 *
 * Credentials live only in this component's state: never persisted, never
 * logged, and sent only to the service the page calls.
 *
 * @module
 */
import { type ReactNode, type SubmitEvent, useState } from 'react';
import type { z } from 'zod';

import { SecretInput } from '@/components/SecretInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeError } from '@/lib/errors';

/** One rendered form field. */
export interface SpikeField<V> {
  name: keyof V & string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
}

interface SpikePageProps<
  S extends z.ZodType<Record<string, unknown>, Record<string, unknown>>,
  R,
> {
  title: string;
  /** Service name for the banner and button, e.g. `GitHub`. */
  service: string;
  fields: readonly SpikeField<z.input<S>>[];
  schema: S;
  defaults: z.input<S>;
  run: (values: z.output<S>) => Promise<R>;
  /** Optional header above the raw JSON result (e.g. a console link). */
  renderResult?: (result: R) => ReactNode;
}

export function SpikePage<
  S extends z.ZodType<Record<string, unknown>, Record<string, unknown>>,
  R,
>({
  title,
  service,
  fields,
  schema,
  defaults,
  run,
  renderResult,
}: SpikePageProps<S, R>): React.JSX.Element {
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...defaults,
  }));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ value: R } | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: SubmitEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setError(null);
    setResult(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setLoading(true);
    run(parsed.data)
      .then((value) => {
        setResult({ value });
      })
      .catch((err: unknown) => {
        setError(describeError(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 rounded-md border border-badge-behind bg-badge-behind/10 px-4 py-3 text-sm">
        <strong>Dev spike:</strong> calls {service} directly from this page.
        Credentials stay in memory only for this session; they are never saved,
        logged, or sent anywhere but {service}.
      </div>

      <h1 className="mb-4 text-lg font-semibold">{title}</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {fields.map(({ name, label, type, placeholder }) => (
          <label key={name} className="flex flex-col gap-1 text-sm">
            {label}
            {(() => {
              const field = {
                autoComplete: 'off',
                placeholder,
                value: typeof values[name] === 'string' ? values[name] : '',
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  setValues((prev) => ({ ...prev, [name]: e.target.value }));
                },
              };
              return type === 'password' ? (
                <SecretInput {...field} />
              ) : (
                <Input {...field} />
              );
            })()}
          </label>
        ))}

        <Button type="submit" disabled={loading} className="mt-2 self-start">
          {loading ? `Calling ${service}\u2026` : 'Run spike'}
        </Button>
      </form>

      {error && (
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md border border-status-failure bg-status-failure/10 p-3 text-xs text-status-failure">
          {error}
        </pre>
      )}

      {result && (
        <div className="mt-4 flex flex-col gap-3">
          {renderResult?.(result.value)}
          <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs">
            {JSON.stringify(result.value, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
