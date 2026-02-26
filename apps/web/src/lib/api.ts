import axios from 'axios';

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nodeweaver-api.onrender.com';

/** Returns the active API base URL (localStorage override → env → default) */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nw_api_url');
    if (saved && saved.trim()) {
      const url = saved.trim().replace(/\/$/, '');
      return url.endsWith('/api') ? url : `${url}/api`;
    }
  }
  const env = DEFAULT_API_URL.replace(/\/$/, '');
  return env.endsWith('/api') ? env : `${env}/api`;
}

export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Dynamic baseURL + Attach Token
api.interceptors.request.use(
  (config) => {
    // Re-read on every request so Settings changes apply immediately
    config.baseURL = getApiBaseUrl();
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 (Logout)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      // Optional: Redirect to login if window exists
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
          window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);
