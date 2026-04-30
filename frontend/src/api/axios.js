import axios from 'axios';
import { mockApi } from './mockApi';

// Mock mode ON karo → VITE_MOCK_MODE=true (.env.local mein)
// Mock mode OFF karo → backend (wrangler) bhi chalana padega
const IS_MOCK = import.meta.env.VITE_MOCK_MODE === 'true';

const api = IS_MOCK
  ? mockApi
  : axios.create({
      baseURL: '/api',
      withCredentials: true
    });

export default api;
