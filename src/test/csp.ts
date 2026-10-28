/**
 * Test helper: a Content-Security-Policy string as its directives.
 *
 * @module
 */

/** Each directive's name and sources, in the policy's order (a directive
 * set twice appears twice, so a test of the names catches it). */
export function cspDirectives(policy: string): [string, string[]][] {
  return policy.split(';').map((part) => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources];
  });
}
