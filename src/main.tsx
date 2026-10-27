/**
 * App entry point: takes a share link out of the URL before routing (its
 * fragment cleared at once, spec.md §3.8), then mounts the React root in
 * strict mode.
 *
 * @module
 */
// First: zod must be jitless before any schema is built (the CSP).
import './zodJitless';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.tsx';
import { takeShareLink } from './share/link';
import { createAppStores } from './storage';
import { StoresContext } from './storage/storesContext';

// Before the router reads the URL, so the link never reaches history.
const link = takeShareLink(window);

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <StoresContext value={createAppStores()}>
      <BrowserRouter>
        <App link={link} />
      </BrowserRouter>
    </StoresContext>
  </StrictMode>,
);
