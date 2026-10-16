/**
 * Site identity constants (product name, licence, outbound links), defined
 * once and shared by the header, footer and any page that names the
 * product.
 *
 * @module
 */

/** Product identity and outbound links. */
export const site = {
  name: 'fooboard',
  /** Product tagline (spec.md C-19); also the X bio. */
  tagline: "Welcome to DevOps hell. Here's your map.",
  license: 'BSD-3-Clause',
  xHandle: '@fooboarding',
  xUrl: 'https://x.com/fooboarding',
  issuesUrl: 'https://github.com/karmaniverous/fooboard/issues',
} as const;
