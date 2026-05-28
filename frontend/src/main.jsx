import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
     <Toaster
  position="bottom-right"
  toastOptions={{
    duration: 4000, // ✅ ADD THIS (global default)
    style: {
      background: '#1A1916',
      color: '#F7F6F2',
      fontSize: '13px',
      fontFamily: '"DM Sans", sans-serif',
      borderRadius: '10px',
      padding: '12px 18px',
    },
    success: { duration: 3000 },
    error: { duration: 4000 },
  }}
/>
    </BrowserRouter>
  </React.StrictMode>
);
