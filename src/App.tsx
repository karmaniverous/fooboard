/**
 * App shell: router wiring for the empty-state home page and the removable
 * Amplify and GitHub browser spikes.
 *
 * @module
 */
import { Route, Routes } from 'react-router-dom';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { CredentialGuidePage } from '@/pages/CredentialGuidePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DemoPage } from '@/pages/DemoPage';
import { Home } from '@/pages/Home';
import { AmplifySpikePage } from '@/pages/spike/AmplifySpikePage';
import { GithubSpikePage } from '@/pages/spike/GithubSpikePage';
import { useStores } from '@/storage/storesContext';

export default function App(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {!useStores().persistent && (
        <p
          role="status"
          className="bg-badge-behind px-5 py-1 text-center text-xs text-badge-behind-text"
        >
          This browser is blocking storage, so nothing you set up here will be
          kept after you close the tab.
        </p>
      )}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/d/:id" element={<DashboardPage />} />
          <Route path="/guide/credentials" element={<CredentialGuidePage />} />
          <Route path="/spike/amplify" element={<AmplifySpikePage />} />
          <Route path="/spike/github" element={<GithubSpikePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
