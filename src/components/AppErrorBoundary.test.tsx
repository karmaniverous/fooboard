/**
 * The app's error screen (spec.md §3.10, Decision 25): the error, the
 * app's version and *Report an issue*, a prefilled GitHub issue carrying
 * the version, the browser and the cleaned message, and no board data or
 * secrets; *Reload*; and the app as usual while nothing throws.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APP_VERSION, site } from '@/lib/site';

import { AppErrorBoundary, type ErrorScreenEnv } from './AppErrorBoundary';

const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

const env = (): ErrorScreenEnv => ({
  origin: 'https://www.fooboard.dev',
  userAgent: 'TestBrowser/1.0',
  reload: vi.fn(),
});

function Thrower({ error }: { error: unknown }): React.JSX.Element {
  throw error;
}

/** The prefilled issue's fields, from the *Report an issue* link. */
const issue = () => {
  const href = screen
    .getByRole('link', { name: 'Report an issue' })
    .getAttribute('href');
  return new URL(href ?? '');
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('renders the app while nothing throws', () => {
    render(
      <AppErrorBoundary env={env()}>
        <p>the board</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('the board')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the error, the version, Reload and Report an issue', () => {
    // React reports the caught error to the console; keep the run quiet.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const screenEnv = env();
    render(
      <AppErrorBoundary env={screenEnv}>
        <Thrower
          error={
            new TypeError(
              `GET https://api.github.com/repos/acme/billing/actions/runs with ${TOKEN} failed`,
            )
          }
        />
      </AppErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    // The page keeps its main landmark; the alert sits inside it.
    expect(screen.getByRole('main')).toContainElement(alert);
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveTextContent(`${site.name} ${APP_VERSION}`);
    // What the issue will carry is what the screen shows: cleaned.
    expect(alert).toHaveTextContent('TypeError: GET <url> with <token> failed');
    expect(alert).not.toHaveTextContent(TOKEN);

    const url = issue();
    expect(`${url.origin}${url.pathname}`).toBe(`${site.issuesUrl}/new`);
    expect([...url.searchParams.keys()]).toEqual(['title', 'body']);
    const body = url.searchParams.get('body') ?? '';
    expect(body).toContain(`**fooboard version:** ${APP_VERSION}`);
    expect(body).toContain('**Browser:** TestBrowser/1.0');
    expect(body).toContain('TypeError: GET <url> with <token> failed');
    expect(url.href).not.toMatch(/ghp_|acme|billing|api\.github\.com/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(screenEnv.reload).toHaveBeenCalledOnce();
  });

  it('describes a thrown value that is not an Error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary env={env()}>
        <Thrower error="plain failure" />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('plain failure');
    expect(issue().searchParams.get('title')).toBe('Error: plain failure');
  });

  it("reads the window's origin, browser and reload by default", () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <Thrower
          error={new Error(`at ${window.location.origin}/assets/a.js?x=1`)}
        />
      </AppErrorBoundary>,
    );
    const body = issue().searchParams.get('body') ?? '';
    expect(body).toContain(`${window.location.origin}/assets/a.js\n`);
    expect(body).toContain(`**Browser:** ${navigator.userAgent}`);
  });
});
