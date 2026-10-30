/**
 * What *Set up with an AI assistant* offers on the site it runs on (spec
 * 0.2.0 §3.J *The dialog uses the current site*, Decision 107): the
 * address of this site's instructions, and a prompt that has the
 * assistant build its link on this site, so the link matches this build's
 * data model. Only production can be read by an assistant; anywhere else
 * (dev, release, a preview, localhost) the user pastes the instructions
 * themselves, and the prompt refers to them.
 *
 * @module
 */
import { PRODUCTION_ORIGIN } from '@/lib/site';

/** What the dialog shows and copies for one origin. */
export interface AiSetup {
  /** This site's instructions for assistants. */
  url: string;
  /** The ready prompt. */
  prompt: string;
  /** Whether an assistant can read `url` itself (production only). */
  reachable: boolean;
}

/** The dialog's address and prompt on the site at `origin` (as
 * `window.location.origin`: scheme, host and port, no trailing slash). */
export function aiSetupFor(origin: string): AiSetup {
  const url = `${origin}/ai`;
  return origin === PRODUCTION_ORIGIN
    ? {
        url,
        prompt: `Read ${url} and help me set up a fooboard board.`,
        reachable: true,
      }
    : {
        url,
        prompt: `Use the fooboard instructions I pasted to help me set up a fooboard board. Build its link on ${origin}/.`,
        reachable: false,
      };
}

/** The text of this site's `/ai.md`, for *Copy instructions*: the file
 * itself from this build (`vite/aiInstructions.ts`), loaded only when
 * asked for, as a chunk of its own, which the CSP's `script-src 'self'`
 * allows (its `connect-src` allows no request to the site itself). */
export const loadInstructions = async (): Promise<string> =>
  (await import('virtual:ai-instructions')).default;
