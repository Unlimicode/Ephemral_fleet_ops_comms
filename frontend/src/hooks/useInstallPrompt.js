import { useState, useEffect, useCallback } from 'react';

const DISMISSED_KEY = 'swiftlink-install-dismissed';

export default function useInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(DISMISSED_KEY) === '1'
    );

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (outcome === 'dismissed') {
            localStorage.setItem(DISMISSED_KEY, '1');
            setDismissed(true);
        }
    }, [deferredPrompt]);

    const dismiss = useCallback(() => {
        localStorage.setItem(DISMISSED_KEY, '1');
        setDismissed(true);
    }, []);

    return {
        canInstall: !!deferredPrompt && !dismissed,
        install,
        dismiss,
    };
}
