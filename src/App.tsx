/**
 * App shell: router wiring for the empty-state home page and the removable
 * Amplify and GitHub browser spikes.
 *
 * @module
 */
import { Route, Routes } from 'react-router-dom';

import { AppNavProvider } from '@/components/AppNavProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useViewportWidthVar } from '@/lib/useViewportWidthVar';
import { PINNED_FULL } from '@/lib/utils';
import { CredentialGuidePage } from '@/pages/CredentialGuidePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DemoPage } from '@/pages/DemoPage';
import { Home } from '@/pages/Home';
import { AmplifySpikePage } from '@/pages/spike/AmplifySpikePage';
import { GithubSpikePage } from '@/pages/spike/GithubSpikePage';
import { useStores } from '@/storage/storesContext';

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
                path="/guide/credentials"
                element={
                  <Page>
                    <CredentialGuidePage />
                  </Page>
                }
              />
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
          </main>
          <Footer />
        </div>
      </AppNavProvider>
    </ThemeProvider>
  );
}
