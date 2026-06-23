import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Theme tokens + app styles (giữ nguyên hệ CSS cũ; tokens.css @import themes/index.css)
import '../css/tokens.css';
import '../css/app.css';

import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
