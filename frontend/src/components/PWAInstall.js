import { useState, useEffect } from 'react';

const getBrowserInfo = () => {
    if (typeof navigator === 'undefined') {
        return { browser: 'unknown', isIOS: false };
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isFirefox = ua.includes('firefox');
    const isEdge = ua.includes('edg/');
    const isOpera = ua.includes('opr/') || ua.includes('opera');
    const isSamsung = ua.includes('samsungbrowser');
    const isChrome = ua.includes('chrome') && !isEdge && !isOpera;
    const isSafari = ua.includes('safari') && !isChrome && !isEdge && !isOpera;

    if (isIOS && isSafari) return { browser: 'ios-safari', isIOS: true };
    if (isFirefox) return { browser: 'firefox', isIOS };
    if (isEdge) return { browser: 'edge', isIOS };
    if (isOpera) return { browser: 'opera', isIOS };
    if (isSamsung) return { browser: 'samsung', isIOS };
    if (isChrome) return { browser: 'chrome', isIOS };
    if (isSafari) return { browser: 'safari', isIOS };
    return { browser: 'unknown', isIOS };
};

const getInstallGuide = () => {
    const { browser } = getBrowserInfo();

    if (browser === 'ios-safari') {
        return {
            title: 'Install on Safari',
            steps: ['Tap the Share button in Safari.', 'Select Add to Home Screen.', 'Tap Add to finish installation.'],
        };
    }

    if (browser === 'firefox') {
        return {
            title: 'Install from Firefox menu',
            steps: ['Tap the Firefox menu button.', 'Choose Install or Add to Home screen.', 'Confirm to place the app on your phone.'],
        };
    }

    return {
        title: 'Install from browser menu',
        steps: ['Tap your browser menu button.', 'Choose Install app or Add to Home screen.', 'Confirm to install DasKitta.'],
    };
};

const isAppRunningStandalone = () => {
    if (typeof window === 'undefined') return false;

    const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const iosStandalone = window.navigator?.standalone === true;
    const twaStandalone = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');

    return Boolean(standaloneDisplay || iosStandalone || twaStandalone);
};

const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
};

export function PWAInstall() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        setIsInstalled(isAppRunningStandalone());

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
            setIsInstalled(true);
            console.log('DasKitta was successfully installed!');
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (isAppRunningStandalone()) {
            setIsInstalled(true);
            setIsInstallable(false);
            setInstallPrompt(null);
            return { status: 'already-installed' };
        }

        if (!installPrompt) return { status: 'unavailable' };

        // Show the native browser install prompt
        installPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstallable(false);
            setInstallPrompt(null);
            setIsInstalled(true);
            return { status: 'accepted' };
        }

        return { status: 'dismissed' };
    };

    return {
        isInstallable,
        isInstalled,
        canInstallNatively: Boolean(installPrompt) && !isInstalled,
        isMobile: isMobileDevice(),
        installGuide: getInstallGuide(),
        handleInstallClick,
    };
}