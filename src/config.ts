export const getBackendURL = () => {
  // If served from the backend (same origin), use that directly
  const origin = window.location.origin;
  const saved = localStorage.getItem('backend_url');
  
  // In production, the captain app is served from the backend at /captain/
  // so window.location.origin IS the backend URL
  // Only use saved URL if explicitly set by user AND we're in dev mode
  const isDev = origin.includes(':5173') || origin.includes(':5174') || origin.includes(':5175');
  
  if (isDev && saved) {
    return saved.replace(/\/+$/, '');
  }
  
  return origin;
};

export const API_BASE = getBackendURL();
