/**
 * The app's navigation items (spec.md C-19), shared by the header buttons,
 * the header menu and the footer, so all three always agree: News &
 * support, README, Demo, Theme, Share / Export, Import, GitHub, Report an
 * issue, then Privacy and Terms (always in the menu, never buttons).
 *
 * Each item is one of four kinds, and every surface renders a kind the
 * same way: an outbound `link`, an in-app `route`, an `action`, or a
 * `choice` among options (a button cycles to the next option; the menu
 * offers them all as radio items).
 *
 * @module
 */
import {
  BookOpen,
  Bug,
  CirclePlay,
  Import,
  Link as LinkIcon,
  Monitor,
  Moon,
  Scale,
  Shield,
  Sun,
} from 'lucide-react';
import { createContext, useContext } from 'react';

import {
  type ThemeChoice,
  ThemeChoiceSchema,
} from '@/domain/config/devicePreferences';
import { site } from '@/lib/site';
import { DEMO_PATH } from '@/pages/paths';

import { GithubLogo, XLogo } from './brandIcons';
import { useTheme } from './themeContext';

export type NavId =
  | 'news'
  | 'readme'
  | 'demo'
  | 'theme'
  | 'share'
  | 'import'
  | 'github'
  | 'issue'
  | 'privacy'
  | 'terms';

interface NavOption {
  value: string;
  label: string;
}

export type NavItem = {
  id: NavId;
  /** Text in the menu and footer; also the button's name and tooltip. */
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Privacy and Terms: always in the menu, never header buttons. */
  legal?: boolean;
} & (
  | { kind: 'link'; href: string }
  | { kind: 'route'; to: string }
  | { kind: 'action'; onSelect: () => void }
  | {
      kind: 'choice';
      /** The choice's name (the menu's radio group). */
      name: string;
      value: string;
      options: readonly NavOption[];
      onChange: (value: string) => void;
    }
);

/** The option after `value`, wrapping round (a choice button's click). */
export const nextOption = (
  options: readonly NavOption[],
  value: string,
): string => {
  const at = options.findIndex((o) => o.value === value);
  return options[(at + 1) % options.length]?.value ?? value;
};

const THEME_LABEL: Record<ThemeChoice, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/** The app's dialogs, opened from the navigation (`AppNavProvider`). */
export interface NavDialogs {
  openShare: () => void;
  /** The import dialog, for a file (spec.md §3.8). */
  openImport: () => void;
  /** The *Reset* confirmation (spec.md §3.9). */
  openReset: () => void;
  /** Mark this build's release notes seen (following the menu's
   * *Release notes*, spec 0.2.0 §3.D). */
  markReleaseNotesSeen: () => void;
  /** Whether this browser hasn't seen this build's release notes (the
   * menu's dot). */
  releaseNotesUnseen: boolean;
}

export const NavContext = createContext<NavDialogs | null>(null);

/** Open the app's dialogs; throws outside `AppNavProvider`. */
export function useNavDialogs(): NavDialogs {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('the app navigation needs AppNavProvider');
  return nav;
}

/** The navigation items in their C-19 order, legal ones last. */
export function useNavItems(): NavItem[] {
  const nav = useNavDialogs();
  const { theme, setTheme } = useTheme();
  return [
    {
      id: 'news',
      kind: 'link',
      label: 'News & support',
      Icon: XLogo,
      href: site.xUrl,
    },
    {
      id: 'readme',
      kind: 'link',
      label: 'README',
      Icon: BookOpen,
      href: site.readmeUrl,
    },
    {
      id: 'demo',
      kind: 'route',
      label: 'Try the demo',
      Icon: CirclePlay,
      to: DEMO_PATH,
    },
    {
      id: 'theme',
      kind: 'choice',
      name: 'Theme',
      label: `Theme: ${THEME_LABEL[theme]}`,
      Icon: THEME_ICON[theme],
      value: theme,
      // System, Light, Dark: the order the button cycles.
      options: ThemeChoiceSchema.options.map((t) => ({
        value: t,
        label: `Theme: ${THEME_LABEL[t]}`,
      })),
      onChange: (v) => {
        const next = ThemeChoiceSchema.safeParse(v);
        if (next.success) setTheme(next.data);
      },
    },
    {
      id: 'share',
      kind: 'action',
      label: 'Share / Export',
      Icon: LinkIcon,
      onSelect: nav.openShare,
    },
    {
      id: 'import',
      kind: 'action',
      label: 'Import',
      Icon: Import,
      onSelect: nav.openImport,
    },
    {
      id: 'github',
      kind: 'link',
      label: 'GitHub',
      Icon: GithubLogo,
      href: site.repoUrl,
    },
    {
      id: 'issue',
      kind: 'link',
      label: 'Report an issue',
      Icon: Bug,
      href: site.issuesUrl,
    },
    {
      id: 'privacy',
      kind: 'link',
      label: 'Privacy',
      Icon: Shield,
      href: site.privacyUrl,
      legal: true,
    },
    {
      id: 'terms',
      kind: 'link',
      label: 'Terms',
      Icon: Scale,
      href: site.termsUrl,
      legal: true,
    },
  ];
}
