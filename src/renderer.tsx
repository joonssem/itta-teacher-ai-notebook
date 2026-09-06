import React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('잇다 화면을 시작할 수 없습니다.');
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

