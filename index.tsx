
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// SAFE ACCESS: Check if env exists before accessing properties
const env = (import.meta as any).env || {};
const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID || "";

if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE") {
  console.warn("Google Client ID is missing in .env file. Auth will not work.");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
