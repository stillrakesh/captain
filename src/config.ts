export const getBackendURL = () => localStorage.getItem('backend_url') || '';
export const API_BASE = getBackendURL();
