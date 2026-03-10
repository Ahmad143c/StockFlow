import axios from 'axios';

const API = axios.create({
  // when running with CRA dev-server, '/api' will be proxied to the backend
  // by adding "proxy": "http://localhost:5000" to package.json;
  // otherwise an explicit REACT_APP_API_URL can still override it.
  baseURL: process.env.REACT_APP_API_URL || '/api',
});

export default API;
