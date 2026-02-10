import React from 'react';
import ReactDOM from 'react-dom/client';
import Toast from '../components/Toast';

let toastContainer = null;
let toastRoot = null;
const activeToasts = [];

const getToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
    toastRoot = ReactDOM.createRoot(toastContainer);
  }
  return { toastContainer, toastRoot };
};

const renderToasts = () => {
  const { toastRoot } = getToastContainer();
  toastRoot.render(
    <React.StrictMode>
      {activeToasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </React.StrictMode>
  );
};

const removeToast = (id) => {
  const index = activeToasts.findIndex((toast) => toast.id === id);
  if (index !== -1) {
    activeToasts.splice(index, 1);
    renderToasts();
  }
};

export const showToast = (message, type = 'info', duration = 3000) => {
  getToastContainer();
  
  const id = Date.now() + Math.random();
  activeToasts.push({ id, message, type, duration });
  
  renderToasts();
};

export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  info: (message, duration) => showToast(message, 'info', duration),
};
