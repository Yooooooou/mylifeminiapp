import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import { initTelegram } from './lib/telegram';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './screens/Dashboard';
import { Income } from './screens/Income';
import { Weight } from './screens/Weight';
import { Habits } from './screens/Habits';
import { Jobs, JobForm } from './screens/Jobs';
import { Debts } from './screens/Debts';
import { History } from './screens/History';

export default function App() {
  // Hash routing keeps deep links from the bot ('#/habits') working without
  // any server-side route configuration.
  useEffect(() => initTelegram(), []);

  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/income" element={<Income />} />
          <Route path="/weight" element={<Weight />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<JobForm />} />
          <Route path="/jobs/:id" element={<JobForm />} />
          <Route path="/debts" element={<Debts />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
