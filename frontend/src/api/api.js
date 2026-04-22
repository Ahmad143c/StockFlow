import axios from 'axios';

const API = axios.create({
  // when running with CRA dev-server, '/api' will be proxied to the backend
  // by adding "proxy": "http://localhost:5000" to package.json;
  // otherwise an explicit REACT_APP_API_URL can still override it.
  baseURL: process.env.REACT_APP_API_URL || '/api',
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
