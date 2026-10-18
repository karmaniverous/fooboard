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
  repoUrl: 'https://github.com/karmaniverous/fooboard',
  issuesUrl: 'https://github.com/karmaniverous/fooboard/issues',
  readmeUrl: 'https://github.com/karmaniverous/fooboard#readme',
  privacyUrl: 'https://github.com/karmaniverous/fooboard/blob/main/PRIVACY.md',
  termsUrl: 'https://github.com/karmaniverous/fooboard/blob/main/TERMS.md',
  /** The app logo, served with the site. */
  logoUrl: `${import.meta.env.BASE_URL}favicon.svg`,
  ownerName: 'karmaniverous',
  ownerUrl: 'https://github.com/karmaniverous',
} as const;

/** README sections the app links to (their GitHub heading anchors). */
const README_SECTIONS = {
  credentials: 'credentials',
  github: 'github-token',
  aws: 'aws-key',
  leaks: 'what-a-leaked-credential-exposes',
} as const;

/** A link straight to a README section on GitHub (spec.md C-3a). */
export const readmeSection = (section: keyof typeof README_SECTIONS): string =>
  `${site.repoUrl}#${README_SECTIONS[section]}`;
