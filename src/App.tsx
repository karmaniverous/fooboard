/**
 * App shell: router wiring for the home page, the demo, creating a
 * dashboard (the first run's steps) and saved dashboards, and the share
 * link the page was opened with.
 *
 * @module
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppNavProvider } from '@/components/AppNavProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StorageBanner } from '@/components/StorageBanner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { FIRST_RUN_PATH } from '@/firstRun/paths';
import { useViewportWidthVar } from '@/lib/useViewportWidthVar';
import { Home } from '@/pages/Home';
import type { LinkPayload } from '@/share/link';

// Board pages load on first visit, so the home page doesn't wait
// for the board, editors and readers.
const DashboardPage = lazy(async () => ({
  default: (await import('@/pages/DashboardPage')).DashboardPage,
}));
const DemoPage = lazy(async () => ({
  default: (await import('@/pages/DemoPage')).DemoPage,
}));
const FirstRunPage = lazy(async () => ({
  default: (await import('@/firstRun/FirstRunPage')).FirstRunPage,
}));

/** Pages other than boards are as wide as the window, so their text wraps
 * instead of widening the shell (which grows only for a wide board). */
function Page({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="w-[var(--vw,100vw)]">{children}</div>;
}

export default function App({
  link = null,
}: {
  /** The share link the page was opened with (spec.md §3.8). */
  link?: LinkPayload | null;
}): React.JSX.Element {
  useViewportWidthVar();
  // The shell grows to the board's width, so the window scrolls sideways
  // while header, warning and footer stay pinned (C-13).
  return (
    <ThemeProvider>
      <AppNavProvider link={link}>
        <div className="flex min-h-screen w-max min-w-full flex-col">
          <Header />
          <StorageBanner />
          <main className="flex-1">
            <Suspense
              fallback={
                <p role="status" className="p-5 text-sm text-muted-foreground">
                  Loading…
                </p>
              }
            >
              <Routes>
                <Route
                  path="/"
                  element={
                    <Page>
                      <Home />
                    </Page>
                  }
                />
                <Route path="/demo" element={<DemoPage />} />
                {[FIRST_RUN_PATH, `${FIRST_RUN_PATH}/:id/:step`].map((path) => (
                  <Route
                    key={path}
                    path={path}
                    element={
                      <Page>
                        <FirstRunPage />
                      </Page>
                    }
                  />
                ))}
                <Route path="/d/:id" element={<DashboardPage />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </AppNavProvider>
    </ThemeProvider>
  );
}
