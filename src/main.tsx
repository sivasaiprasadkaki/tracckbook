import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[TrackBook] SW registered with scope:', registration.scope);
          // Check for updates on load so new deployments show immediately
          registration.update().catch(() => {});
        })
        .catch((registrationError) => {
          console.warn('[TrackBook] SW registration failed:', registrationError);
        });
    };

    // In Android WebView and fast-loading pages, readyState may already be complete
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }
  } else {
    // In dev mode, unregister any active service worker so it doesn't serve stale/cached Vite modules
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
