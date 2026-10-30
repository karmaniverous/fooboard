/**
 * Values Vite defines at build time, and its virtual modules
 * (`vite.config.ts`).
 *
 * @module
 */

/** The app's version, from `package.json`. */
declare const __APP_VERSION__: string;

/** The text of `public/ai.md` (`vite/aiInstructions.ts`). */
declare module 'virtual:ai-instructions' {
  const text: string;
  export default text;
}
