/**
 * App shell: router wiring for the home page, the demo, creating a
 * dashboard (the first run's steps), saved dashboards and *Page not found*
 * for any other address (spec.md §2.16, Scope item 6), and the share
 * link the page was opened with; under the theme, the error boundary
 * (spec.md §3.10), which shows the error screen in place of the whole
 * app if any of it throws while rendering.
 *
 * @module
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppNavProvider } from '@/components/AppNavProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { StorageBanner } from '@/components/StorageBanner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { FIRST_RUN_PATH, FIRST_RUN_STEP_ROUTE } from '@/firstRun/paths';
import { useViewportWidthVar } from '@/lib/useViewportWidthVar';
import { Home } from '@/pages/Home';
import { PageNotFound } from '@/pages/PageNotFound';
import { DASHBOARD_ROUTE, DEMO_PATH, HOME_PATH } from '@/pages/paths';
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
      <AppErrorBoundary>
        <AppNavProvider link={link}>
          <div className="flex min-h-screen w-max min-w-full flex-col">
            <Header />
            <StorageBanner />
            <main className="flex-1">
              <Suspense
                fallback={
                  <p
                    role="status"
                    className="p-5 text-sm text-muted-foreground"
                  >
                    Loading…
                  </p>
                }
              >
                <Routes>
                  <Route
                    path={HOME_PATH}
                    element={
                      <Page>
                        <Home />
                      </Page>
                    }
                  />
                  <Route path={DEMO_PATH} element={<DemoPage />} />
                  {[FIRST_RUN_PATH, FIRST_RUN_STEP_ROUTE].map((path) => (
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
                  <Route path={DASHBOARD_ROUTE} element={<DashboardPage />} />
                  <Route
                    path="*"
                    element={
                      <Page>
                        <PageNotFound />
                      </Page>
                    }
                  />
                </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </AppNavProvider>
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
