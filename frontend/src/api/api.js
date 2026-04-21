import axios from 'axios';

// Detect if running in GitHub Codespaces and use the appropriate backend URL
const getBaseURL = () => {
  // Check if REACT_APP_API_URL is explicitly set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Check if running in GitHub Codespaces
  if (window.location.hostname.includes('.app.github.dev')) {
    // Extract the codespace name and construct the backend URL
    const codespaceUrl = window.location.hostname;
    const parts = codespaceUrl.split('-');
    const codespaceName = parts.slice(0, -1).join('-');
    return `https://${codespaceName}-5000.app.github.dev`;
  }

  // Default to local development
  return '/api';
};

const API = axios.create({
  baseURL: getBaseURL(),
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
