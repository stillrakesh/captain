export const BASE_URL = 'http://localhost:3000';
export const getBackendURL = () => {
  let url = localStorage.getItem('backend_url') || BASE_URL;
  if (url && url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
};
export const API_BASE = getBackendURL();
