/**
 * App entry point: mounts the React root in strict mode.
 *
 * @module
 */
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.tsx';
import { createAppStores } from './storage';
import { StoresContext } from './storage/storesContext';

const container = document.getElementById('root');
if (!container) throw new Error('#root element not found');

createRoot(container).render(
  <StrictMode>
    <StoresContext value={createAppStores()}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoresContext>
  </StrictMode>,
);
