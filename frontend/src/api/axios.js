import axios from 'axios';

const api = axios.create({
  baseURL: '/api', // Proxied by Vite to the backend
  withCredentials: true // Important to send cookies with requests
});

export default api;
