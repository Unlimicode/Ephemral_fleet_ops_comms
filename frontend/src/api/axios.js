import axios from 'axios';

// _token is a module-level store updated by setAuthToken. The request interceptor
// reads this value so the axios instance never needs a direct reference to the
// React auth context — avoiding a circular import between this module and AuthContext.
let _token = null;
try {
    _token = sessionStorage.getItem('swiftlink_token') || null;
} catch { _token = null; }

export function setAuthToken(token) {
    _token = token;
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
});

// Attach the bearer token to every outgoing request when a session is active.
api.interceptors.request.use((config) => {
    if (_token) {
        config.headers.Authorization = `Bearer ${_token}`;
    }
    return config;
});

// On 401, redirect to the login page. This handles token expiry globally without
// requiring each call site to detect and handle authentication failures.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            window.location.replace('/login');
        }
        return Promise.reject(error);
    }
);

export default api;
