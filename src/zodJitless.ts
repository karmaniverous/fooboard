/**
 * Turns off zod's JIT before any schema is built (spec.md §3.10, the CSP).
 * An object schema checks once, when it is built, whether `new Function`
 * works; under the CSP (`script-src 'self'`, no `'unsafe-eval'`) the check
 * throws and zod falls back to its interpreter, but the browser still
 * reports a `securitypolicyviolation` for every page load. With `jitless`
 * zod skips the check and uses the interpreter it would have used anyway.
 *
 * `main.tsx` imports this first, ahead of every module that builds a
 * schema.
 *
 * @module
 */
import { z } from 'zod';

z.config({ jitless: true });
