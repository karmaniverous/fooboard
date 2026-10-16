/**
 * App shell: router wiring for the empty-state home page and the removable
 * Amplify and GitHub browser spikes.
 *
 * @module
 */
import { Route, Routes } from 'react-router-dom';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Home } from '@/pages/Home';
import { AmplifySpikePage } from '@/pages/spike/AmplifySpikePage';
import { GithubSpikePage } from '@/pages/spike/GithubSpikePage';

export default function App(): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/spike/amplify" element={<AmplifySpikePage />} />
          <Route path="/spike/github" element={<GithubSpikePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
