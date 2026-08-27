import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { initTelegram } from './lib/telegram';
import { initialRoute } from './lib/route';
import { TabBar } from './components/TabBar';
import { ToastProvider } from './components/Toast';
import { Today } from './screens/Today';
import { Money } from './screens/Money';
import { Career } from './screens/Career';
import { Progress } from './screens/Progress';
import { Income } from './screens/Income';
import { Weight } from './screens/Weight';
import { Habits } from './screens/Habits';
import { JobForm } from './screens/Jobs';
import { Debts, NewDebt } from './screens/Debts';
import { History } from './screens/History';

/**
 * Forms and detail pages open over a section and use Telegram's Back button, so
 * they hide the tab bar. Everything else shows it — stated as "not an overlay"
 * rather than a list of section paths, so an unrecognised route still lands on
 * a screen with navigation instead of a dead end.
 */
const OVERLAYS = ['/income', '/weight', '/habits', '/history'];

function Chrome() {
  const { pathname } = useLocation();
  const overlay =
    OVERLAYS.includes(pathname) ||
    pathname.startsWith('/jobs/') ||
    pathname.startsWith('/debts/');
  return overlay ? null : <TabBar />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  useEffect(() => initTelegram(), []);

  return (
    <ToastProvider>
      <MemoryRouter initialEntries={[initialRoute()]}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/money" element={<Money />} />
          <Route path="/career" element={<Career />} />
          <Route path="/progress" element={<Progress />} />

          <Route path="/income" element={<Income />} />
          <Route path="/weight" element={<Weight />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/jobs/new" element={<JobForm />} />
          <Route path="/jobs/:id" element={<JobForm />} />
          {/* The literal path is declared first and with its own component:
              "/debts/new" matches this route, not "/debts/:id", so reading the
              id to tell them apart never worked. */}
          <Route path="/debts/new" element={<NewDebt />} />
          <Route path="/debts/:id" element={<Debts />} />
          <Route path="/history" element={<History />} />

          <Route path="*" element={<Today />} />
        </Routes>
        <Chrome />
      </MemoryRouter>
    </ToastProvider>
  );
}
