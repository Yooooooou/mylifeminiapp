import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { normalizeHash } from './lib/route';
// Imported for its side effect: the launch parameters are captured out of the
// fragment before normalizeHash rewrites it. Order matters here.
import './lib/telegram';
import './index.css';

normalizeHash();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
