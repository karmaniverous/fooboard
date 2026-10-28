/**
 * How to remove secrets this browser wouldn't let fooboard remove: *Reset*
 * (spec.md §3.9), which clears them from storage and from every open
 * tab's memory. Ends every message about a secret left behind, from the
 * credential store (a refused removal on *Forget* or on keeping a secret
 * for this tab only, fooboard#21) and from the operations that clean up
 * after a failed save (`credentialOps`).
 *
 * @module
 */

export const LEFTOVER_SECRETS_HINT =
  "Use Reset, in the menu, to clear what was left; it removes all of fooboard's data from this browser, dashboards included.";
