/**
 * What *Set up with an AI assistant* offers on the site it runs on (spec
 * 0.2.0 §3.J *The dialog uses the current site*, *The dialog's layout,
 * revised*; Decisions 107 and 108): the address of this site's
 * instructions, so the link the assistant builds matches this build's
 * data model, and a prompt pointing at them. The instructions are
 * self-contained, so the prompt needs nothing else; on a site an
 * assistant can't reach, *Copy instructions* gives the same text to paste.
 *
 * @module
 */

/** What the dialog shows and copies for one origin. */
export interface AiSetup {
  /** This site's instructions for assistants. */
  url: string;
  /** The ready prompt. */
  prompt: string;
}

/** The dialog's address and prompt on the site at `origin` (as
 * `window.location.origin`: scheme, host and port, no trailing slash). */
export function aiSetupFor(origin: string): AiSetup {
  const url = `${origin}/ai`;
  return { url, prompt: `Follow the instructions at ${url}` };
}

/** The text of this site's `/ai.md`, for *Copy instructions*: the file
 * itself from this build (`vite/aiInstructions.ts`), loaded only when
 * asked for, as a chunk of its own, which the CSP's `script-src 'self'`
 * allows (its `connect-src` allows no request to the site itself). */
export const loadInstructions = async (): Promise<string> =>
  (await import('virtual:ai-instructions')).default;
