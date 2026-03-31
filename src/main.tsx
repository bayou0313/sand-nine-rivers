import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root')!;

if (rootElement.hasChildNodes()) {
  // Hydrate prerendered HTML — react-snap production snapshot
  hydrateRoot(
    rootElement,
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  // Fresh client-side render — dev mode or non-prerendered routes
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
