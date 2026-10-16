/**
 * App footer: outbound links only (no embedded widgets, per spec.md C-7/C-19).
 *
 * @module
 */
export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-border px-5 py-5 text-center text-xs text-muted-foreground">
      <p>
        fooboard &middot; static, browser-only, no servers &middot; BSD-3-Clause
      </p>
      <p className="mt-1">
        <a
          href="https://x.com/fooboarding"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          News &amp; support on X @fooboarding
        </a>
        {' · '}
        <a
          href="https://github.com/karmaniverous/fooboard/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Report an issue
        </a>
      </p>
    </footer>
  );
}
