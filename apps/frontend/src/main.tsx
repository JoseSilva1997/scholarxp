// App entrypoint: bootstraps logging and mounts the React tree.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
// Unlockable theme token overrides — imported here so the cascade order is stable regardless of bundler behavior.
import '@/styles/themes/aurora.css';
import '@/styles/themes/midnight.css';
import '@/styles/themes/ember.css';
import '@/styles/themes/celestial.css';
import App from '@/App.tsx';
import { AppQueryProvider } from '@/context/QueryProvider';
import { ThemeProvider } from '@/context/ThemeContext';
import { initLogger } from '@/utils/logger';

initLogger({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
  release: import.meta.env.VITE_SENTRY_RELEASE,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppQueryProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppQueryProvider>
  </StrictMode>,
);
