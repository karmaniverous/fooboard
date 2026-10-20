/**
 * App shell: router wiring for the empty-state home page and the removable
 * Amplify and GitHub browser spikes.
 *
 * @module
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppNavProvider } from '@/components/AppNavProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useViewportWidthVar } from '@/lib/useViewportWidthVar';
import { PINNED_FULL } from '@/lib/utils';
import { Home } from '@/pages/Home';
import { useStores } from '@/storage/storesContext';

// Board and spike pages load on first visit, so the home page doesn't wait
// for the board, editors and readers.
const DashboardPage = lazy(async () => ({
  default: (await import('@/pages/DashboardPage')).DashboardPage,
}));
const DemoPage = lazy(async () => ({
  default: (await import('@/pages/DemoPage')).DemoPage,
}));
const AmplifySpikePage = lazy(async () => ({
  default: (await import('@/pages/spike/AmplifySpikePage')).AmplifySpikePage,
}));
const GithubSpikePage = lazy(async () => ({
  default: (await import('@/pages/spike/GithubSpikePage')).GithubSpikePage,
}));

/** Pages other than boards are as wide as the window, so their text wraps
 * instead of widening the shell (which grows only for a wide board). */
function Page({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="w-[var(--vw,100vw)]">{children}</div>;
}

export default function App(): React.JSX.Element {
  useViewportWidthVar();
  // The shell grows to the board's width, so the window scrolls sideways
  // while header, warning and footer stay pinned (C-13).
  return (
    <ThemeProvider>
      <AppNavProvider>
        <div className="flex min-h-screen w-max min-w-full flex-col">
          <Header />
          {!useStores().persistent && (
            <p
              role="status"
              className={`${PINNED_FULL} bg-badge-behind px-5 py-1 text-center text-xs text-badge-behind-text`}
            >
              This browser is blocking storage, so nothing you set up here will
              be kept after you close the tab.
            </p>
          )}
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
                <Route path="/d/:id" element={<DashboardPage />} />
                <Route
                  path="/spike/amplify"
                  element={
                    <Page>
                      <AmplifySpikePage />
                    </Page>
                  }
                />
                <Route
                  path="/spike/github"
                  element={
                    <Page>
                      <GithubSpikePage />
                    </Page>
                  }
                />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </AppNavProvider>
    </ThemeProvider>
  );
}
