// ─────────────────────────────────────────────────────────────────────────────
// usePushNotifications — React Hook for Push Subscription Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';

// urlBase64ToUint8Array converts the VAPID public key from URL-safe base64 to
// a Uint8Array as required by the Web Push API. The conversion handles the
// padding and the '+'/'-' and '/''_' character substitutions that standard
// atob() does not handle.
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function usePushNotifications() {
    const supported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

    const [subscribed, setSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [registration, setRegistration] = useState(null);
    const [publicKey, setPublicKey] = useState(null);

    useEffect(() => {
        if (!supported) return;

        let cancelled = false;

        async function init() {
            try {
                // Fetch the VAPID public key from the backend.
                const res = await fetch(`${import.meta.env.VITE_API_URL}/push/vapid-public-key`);
                if (!res.ok) throw new Error('Failed to fetch VAPID public key');
                const { publicKey: key } = await res.json();

                // Register the service worker if not already registered.
                const reg = await navigator.serviceWorker.register('/sw.js');

                // Check whether a push subscription already exists.
                const existing = await reg.pushManager.getSubscription();

                if (!cancelled) {
                    setPublicKey(key);
                    setRegistration(reg);
                    setSubscribed(!!existing);
                }
            } catch (err) {
                if (!cancelled) setError(err.message);
            }
        }

        init();

        return () => {
            cancelled = true;
        };
    }, [supported]);

    // subscribe accepts a driver auth token so the hook remains decoupled from
    // any specific storage mechanism. The calling component supplies the token
    // from wherever auth state lives at the time of invocation.
    const subscribe = useCallback(
        async (token) => {
            if (!registration || !publicKey) return;
            setLoading(true);
            setError(null);
            try {
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(publicKey),
                });

                const res = await fetch(`${import.meta.env.VITE_API_URL}/push/subscribe`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(subscription),
                });

                if (!res.ok) throw new Error('Failed to register push subscription');
                setSubscribed(true);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        },
        [registration, publicKey]
    );

    // unsubscribe also accepts the auth token to remove the subscription record
    // from the backend in addition to unsubscribing locally in the browser.
    const unsubscribe = useCallback(
        async (token) => {
            if (!registration) return;
            setLoading(true);
            setError(null);
            try {
                const subscription = await registration.pushManager.getSubscription();
                if (!subscription) {
                    setSubscribed(false);
                    return;
                }

                await fetch(`${import.meta.env.VITE_API_URL}/push/subscribe`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });

                await subscription.unsubscribe();
                setSubscribed(false);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        },
        [registration]
    );

    if (!supported) {
        return { supported: false };
    }

    return { supported, subscribed, subscribe, unsubscribe, loading, error };
}
