/**
 * The app's error boundary (spec.md §3.10, Decision 25): when rendering
 * throws, the app shows the error, its version and *Report an issue*,
 * which opens a new GitHub issue prefilled with the version, the browser
 * and the error message, cleaned of anything shaped like a secret or a
 * board's names (`issueReport`), and nothing else; the screen shows what
 * the issue will carry. With no telemetry, this is the only error
 * reporting (React also logs the error to the browser's console). *Reload*
 * starts the app again.
 *
 * @module
 */
import { Bug, RotateCcw } from 'lucide-react';
import { Component } from 'react';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { describeError } from '@/lib/errors';
import { cleanErrorMessage, issueUrl } from '@/lib/issueReport';
import { APP_VERSION, site } from '@/lib/site';

import { ExternalLink } from './ExternalLink';

/** What the error screen reads from the page (the window's by default). */
export interface ErrorScreenEnv {
  /** The app's own origin: links to its files stay in the message. */
  origin: string;
  /** The browser, as it names itself. */
  userAgent: string;
  /** Start the app again. */
  reload: () => void;
}

const windowEnv = (): ErrorScreenEnv => ({
  origin: window.location.origin,
  userAgent: navigator.userAgent,
  reload: () => {
    window.location.reload();
  },
});

/** The error screen: what went wrong, the version, and the way out. */
function ErrorScreen({
  error,
  env,
}: {
  error: unknown;
  env: ErrorScreenEnv;
}): React.JSX.Element {
  const message = cleanErrorMessage(describeError(error), env.origin);
  const report = { version: APP_VERSION, browser: env.userAgent, message };
  return (
    <main
      role="alert"
      className="mx-auto flex max-w-xl flex-col gap-4 p-5 text-foreground"
    >
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm">
        {site.name} hit an error it couldn&apos;t recover from. Reloading
        usually clears it; your dashboards and settings are kept.
      </p>
      <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted p-3 text-sm">
        {message}
      </pre>
      <p className="text-sm text-muted-foreground">
        {site.name} {APP_VERSION}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="gap-2" onClick={env.reload}>
          <RotateCcw aria-hidden className="size-4" />
          Reload
        </Button>
        <ExternalLink
          unstyled
          href={issueUrl(report)}
          className={buttonVariants({ variant: 'outline', className: 'gap-2' })}
        >
          <Bug aria-hidden className="size-4" />
          Report an issue
        </ExternalLink>
      </div>
      <p className="text-sm text-muted-foreground">
        <em>Report an issue</em> opens a new issue on GitHub with the version,
        your browser ({env.userAgent}) and the message above, and no board data.
        Nothing is sent until you submit it there.
      </p>
    </main>
  );
}

interface State {
  error?: { value: unknown };
}

/** Shows {@link ErrorScreen} in place of `children` once they throw. */
export class AppErrorBoundary extends Component<
  { children: React.ReactNode; env?: ErrorScreenEnv },
  State
> {
  override state: State = {};

  static getDerivedStateFromError(error: unknown): State {
    return { error: { value: error } };
  }

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ErrorScreen error={error.value} env={this.props.env ?? windowEnv()} />
    );
  }
}
