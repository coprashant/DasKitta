import { useState, useEffect } from 'react';

export function PWAInstall() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Prevent Chrome from automatically showing its own banner
            e.preventDefault();
            // Store the event so we can trigger it later
            setInstallPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Track if the user actually installed it
        const handleAppInstalled = () => {
            setIsInstallable(false);
            setInstallPrompt(null);
            console.log('DasKitta was successfully installed!');
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;

        // Show the native browser install prompt
        installPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstallable(false);
            setInstallPrompt(null);
        }
    };

    return { isInstallable, handleInstallClick };
}