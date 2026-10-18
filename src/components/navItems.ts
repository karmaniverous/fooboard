/**
 * The app's navigation items (spec.md C-19), shared by the header buttons,
 * the header menu and the footer, so all three always agree: News &
 * support, README, Demo, Theme, Share / Export, Import, GitHub, Report an
 * issue, then Privacy and Terms (always in the menu, never buttons).
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

import type { ThemeChoice } from '@/domain/config/devicePreferences';
import { site } from '@/lib/site';
import { nextTheme } from '@/lib/theme';

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

export interface NavItem {
  id: NavId;
  /** Text in the menu and footer; also the button's name and tooltip. */
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** An outbound link. */
  href?: string;
  /** An in-app route. */
  to?: string;
  onSelect?: () => void;
  /** Shown but not usable yet (Import until PR E). */
  disabled?: boolean;
  /** Privacy and Terms: always in the menu, never header buttons. */
  legal?: boolean;
}

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

export const NavContext = createContext<{ openShare: () => void } | null>(null);

/** The navigation items in their C-19 order, legal ones last. */
export function useNavItems(): NavItem[] {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNavItems must be used inside AppNavProvider');
  const { theme, setTheme } = useTheme();
  return [
    { id: 'news', label: 'News & support', Icon: XLogo, href: site.xUrl },
    { id: 'readme', label: 'README', Icon: BookOpen, href: site.readmeUrl },
    { id: 'demo', label: 'Try the demo', Icon: CirclePlay, to: '/demo' },
    {
      id: 'theme',
      label: `Theme: ${THEME_LABEL[theme]}`,
      Icon: THEME_ICON[theme],
      onSelect: () => {
        setTheme(nextTheme(theme));
      },
    },
    {
      id: 'share',
      label: 'Share / Export',
      Icon: LinkIcon,
      onSelect: nav.openShare,
    },
    {
      id: 'import',
      label: 'Import (coming soon)',
      Icon: Import,
      disabled: true,
    },
    { id: 'github', label: 'GitHub', Icon: GithubLogo, href: site.repoUrl },
    { id: 'issue', label: 'Report an issue', Icon: Bug, href: site.issuesUrl },
    {
      id: 'privacy',
      label: 'Privacy',
      Icon: Shield,
      href: site.privacyUrl,
      legal: true,
    },
    {
      id: 'terms',
      label: 'Terms',
      Icon: Scale,
      href: site.termsUrl,
      legal: true,
    },
  ];
}
