/**
 * Centralized API configuration.
 *
 * All API calls should use these helpers instead of hardcoding URLs.
 * The base URL is read from the VITE_API_URL environment variable,
 * falling back to http://localhost:5001 for local development.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Perform a fetch request against the API.
 *
 * @param {string}        path     - The API path (e.g. '/api/projects').
 * @param {RequestInit}   [options] - Standard fetch options (method, headers, body, etc.).
 * @returns {Promise<Response>}
 */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  let response = await fetch(url, options);

  if (response.status === 401 && !path.includes('/api/auth/')) {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          if (options.headers && options.headers['Authorization']) {
            options.headers['Authorization'] = `Bearer ${token}`;
          }
          return fetch(url, options);
        }).catch(err => {
          return response;
        });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('refreshToken', data.refreshToken);
          
          if (options.headers && options.headers['Authorization']) {
            options.headers['Authorization'] = `Bearer ${data.token}`;
          }
          
          processQueue(null, data.token);
          response = await fetch(url, options);
        } else {
          processQueue(new Error('Refresh failed'));
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.dispatchEvent(new Event('auth-expired'));
        }
      } catch (err) {
        processQueue(err);
      } finally {
        isRefreshing = false;
      }
    } else {
      window.dispatchEvent(new Event('auth-expired'));
    }
  }

  return response;
}

/**
 * Build a full URL for static assets served by the backend (e.g. uploaded files).
 *
 * @param {string} path - The asset path (e.g. '/uploads/image.png').
 * @returns {string}
 */
export function assetUrl(path) {
  return `${API_BASE_URL}${path}`;
}
