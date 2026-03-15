import { createContext, useContext, useState, useCallback } from 'react';
import api, { setAuthToken } from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
        const stored = sessionStorage.getItem('swiftlink_token') || null;
        if (stored) setAuthToken(stored);
        return stored;
    });
    const [role, setRole] = useState(() => sessionStorage.getItem('swiftlink_role') || null);
    const [user, setUser] = useState(() => {
        try {
            const u = sessionStorage.getItem('swiftlink_user');
            return u && u !== 'undefined' ? JSON.parse(u) : null;
        } catch { return null; }
    });

    const isAuthenticated = !!token;

    const login = useCallback((newToken, newRole, newUser) => {
        sessionStorage.setItem('swiftlink_token', newToken);
        sessionStorage.setItem('swiftlink_role', newRole);
        sessionStorage.setItem('swiftlink_user', JSON.stringify(newUser));

        setAuthToken(newToken);
        setToken(newToken);
        setRole(newRole);
        setUser(newUser);
    }, []);

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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}