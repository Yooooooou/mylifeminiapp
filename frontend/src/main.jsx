import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { normalizeHash } from './lib/route';
import './index.css';

// Must run before the router reads the fragment for the first time.
normalizeHash();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
