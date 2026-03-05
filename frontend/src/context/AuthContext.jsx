import { createContext, useContext, useState, useCallback } from 'react';
import api, { setAuthToken } from '../api/axios.js';

// AuthContext manages authentication state for fleet manager and driver roles.
// Token, role, and user are held in React state only — never persisted to
// localStorage or sessionStorage — to prevent XSS exfiltration of credentials.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [auth, setAuth] = useState({ token: null, role: null, user: null });

    // login stores credentials in state and injects the token into the axios instance.
    const login = useCallback((token, role, user) => {
        setAuthToken(token);
        setAuth({ token, role, user });
    }, []);

    // logout calls the correct backend endpoint based on role before clearing state.
    // The try/catch ensures state is always cleared even if the server request fails.
    const logout = useCallback(async () => {
        try {
            if (auth.role === 'fleet_manager') {
                await api.post('/api/auth/logout');
            } else if (auth.role === 'driver') {
                await api.post('/api/drivers/auth/logout');
            }
        } catch {
            // Logout errors are non-fatal — state is cleared regardless.
        }
        setAuthToken(null);
        setAuth({ token: null, role: null, user: null });
    }, [auth.role]);

    const isAuthenticated = !!auth.token;

    return (
        <AuthContext.Provider
            value={{ token: auth.token, role: auth.role, user: auth.user, isAuthenticated, login, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// useAuth provides the auth context value to any component in the tree.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}
