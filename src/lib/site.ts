/**
 * Site identity constants (product name, licence, outbound links), defined
 * once and shared by the header, footer and any page that names the
 * product.
 *
 * @module
 */
import { TAGLINE } from './pageHead';
import { PRODUCTION_ORIGIN } from './productionOrigin';

/** Product identity and outbound links. */
export const site = {
  name: 'fooboard',
  /** Product tagline (spec.md C-19); also the X bio. */
  tagline: TAGLINE,
  license: 'BSD-3-Clause',
  xHandle: '@fooboarding',
  xUrl: 'https://x.com/fooboarding',
  repoUrl: 'https://github.com/karmaniverous/fooboard',
  issuesUrl: 'https://github.com/karmaniverous/fooboard/issues',
  readmeUrl: 'https://github.com/karmaniverous/fooboard#readme',
  /** The instructions for AI assistants as the discovery pointers name
   * them (spec 0.2.0 §3.J *Discovery*): production's, on every host
   * (Decision 96). *Set up with an AI assistant* gives the current site's
   * instead (`aiSetupFor`, Decision 107). */
  aiUrl: `${PRODUCTION_ORIGIN}/ai`,
  /** The menu's *Release notes* (spec 0.2.0 §3.D). */
  releasesUrl: 'https://github.com/karmaniverous/fooboard/releases',
  privacyUrl: 'https://github.com/karmaniverous/fooboard/blob/main/PRIVACY.md',
  termsUrl: 'https://github.com/karmaniverous/fooboard/blob/main/TERMS.md',
  /** The app logo, served with the site. */
  logoUrl: `${import.meta.env.BASE_URL}favicon.svg`,
  ownerName: 'karmaniverous',
  ownerUrl: 'https://github.com/karmaniverous',
} as const;

/** This build's version (`package.json`; spec.md §3.10): in the menu and
 * on the error screen. */
export const APP_VERSION: string = __APP_VERSION__;

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
