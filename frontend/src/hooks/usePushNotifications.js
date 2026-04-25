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

// token is optional. When provided, any existing browser subscription is
// silently re-synced with the backend on init. This handles the case where the
// browser rotates push subscription keys (after a SW update, browser restart,
// etc.) and the old endpoint stored in the DB becomes stale. Without re-sync,
// the backend sends to the stale endpoint, receives a 410, deletes it, and the
// driver never receives notifications again.
export default function usePushNotifications(token = null) {
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

                // Check whether a push subscription already exists in the browser.
                const existing = await reg.pushManager.getSubscription();

                // If a browser subscription exists and we have a token, re-register
                // it with the backend. The backend endpoint is an upsert so this is
                // safe to call on every init — it corrects the DB if the browser has
                // rotated its subscription keys since the last registration.
                if (existing && token) {
                    try {
                        await fetch(`${import.meta.env.VITE_API_URL}/push/subscribe`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify(existing),
                        });
                    } catch {
                        // Best-effort — do not block init if the sync request fails.
                    }
                }

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
    }, [supported, token]);

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
