import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';

import { initTelegram } from './lib/telegram';
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
import { Debts } from './screens/Debts';
import { History } from './screens/History';

// The four sections carry the tab bar; forms and detail pages open over them
// and rely on Telegram's own Back button instead.
const SECTIONS = ['/', '/money', '/career', '/progress'];

function Chrome() {
  const { pathname } = useLocation();
  return SECTIONS.includes(pathname) ? <TabBar /> : null;
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
      <HashRouter>
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
          <Route path="/debts" element={<Debts />} />
          <Route path="/debts/new" element={<Debts />} />
          <Route path="/debts/:id" element={<Debts />} />
          <Route path="/history" element={<History />} />

          <Route path="*" element={<Today />} />
        </Routes>
        <Chrome />
      </HashRouter>
    </ToastProvider>
  );
}
