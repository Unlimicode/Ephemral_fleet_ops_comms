import { createContext, useContext, useState, useCallback } from 'react';
import api, { setAuthToken } from '../api/axios.js';

// AuthContext manages authentication state for fleet manager and driver roles.
// Token, role, and user are persisted to sessionStorage to maintain
// session continuity on page refresh.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => sessionStorage.getItem('swiftlink_token') || null);
    const [role, setRole] = useState(() => sessionStorage.getItem('swiftlink_role') || null);
    const [user, setUser] = useState(() => {
        try {
            const u = sessionStorage.getItem('swiftlink_user');
            return u && u !== 'undefined' ? JSON.parse(u) : null;
        } catch { return null; }
    });

    const isAuthenticated = !!token;

    // login stores credentials in state, sessionStorage, and injects the token into the axios instance.
    const login = useCallback((newToken, newRole, newUser) => {
        sessionStorage.setItem('swiftlink_token', newToken);
        sessionStorage.setItem('swiftlink_role', newRole);
        sessionStorage.setItem('swiftlink_user', JSON.stringify(newUser));

        setAuthToken(newToken);
        setToken(newToken);
        setRole(newRole);
        setUser(newUser);
    }, []);

    // logout calls the correct backend endpoint based on role before clearing state.
    // The try/catch ensures state is always cleared even if the server request fails.
    const logout = useCallback(async () => {
        try {
            if (role === 'fleet_manager') {
                await api.post('/auth/logout');
            } else if (role === 'driver') {
                await api.post('/drivers/auth/logout');
            }
        } catch {
            // Logout errors are non-fatal — state is cleared regardless.
        }
        setAuthToken(null);
        sessionStorage.removeItem('swiftlink_token');
        sessionStorage.removeItem('swiftlink_role');
        sessionStorage.removeItem('swiftlink_user');

        setToken(null);
        setRole(null);
        setUser(null);
    }, [role]);

    return (
        <AuthContext.Provider
            value={{ token, role, user, isAuthenticated, login, logout }}
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
