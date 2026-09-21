import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { clearSupabaseAuthStorage } from './lib/supabase';

// Global error handlers to intercept and recover from transient network drops and stale auth tokens
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (typeof reason === 'string' ? reason : reason?.message || reason?.name || '') + '';
    
    // Check for invalid refresh token or stale token errors
    if (
      msg.includes('Invalid Refresh Token') ||
      msg.includes('Refresh Token Not Found') ||
      msg.includes('invalid_grant') ||
      msg.includes('Refresh token')
    ) {
      console.warn('[Global Safety] Stale refresh token detected in unhandled rejection. Clearing auth storage to recover.');
      clearSupabaseAuthStorage();
      event.preventDefault();
      return;
    }

    // Check for transient network/fetch failure
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('network request failed')
    ) {
      console.warn('[Global Safety] Suppressed unhandled network rejection:', msg);
      event.preventDefault();
      return;
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('Invalid Refresh Token') ||
      msg.includes('Refresh Token Not Found')
    ) {
      if (msg.includes('Invalid Refresh Token') || msg.includes('Refresh Token Not Found')) {
        clearSupabaseAuthStorage();
      }
      console.warn('[Global Safety] Suppressed error event:', msg);
      event.preventDefault();
    }
  });
}

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
    // In dev mode, unregister any active service worker and clear stale caches so it doesn't serve stale/cached Vite modules
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      }).catch(() => {});
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
