import axios from 'axios';

// Detect if running in GitHub Codespaces
const isCodespaces = window.location.hostname.includes('.app.github.dev');

// In Codespaces, use the Codespaces URL with port 5000 for backend
// Otherwise, use proxy or explicit API URL
const baseURL = isCodespaces
  ? window.location.origin.replace('-3000', '-5000') + '/api'
  : process.env.REACT_APP_API_URL || '/api';

const API = axios.create({
  baseURL,
});

// Add response interceptor to handle 401 errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const errorMessage = error.response.data?.message || '';
      // Check if error is due to password change
      if (errorMessage === 'Password changed. Please login again.') {
        // Clear token and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;
