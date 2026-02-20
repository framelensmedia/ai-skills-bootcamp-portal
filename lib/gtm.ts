declare global {
    interface Window {
        dataLayer: any[];
    }
}

export const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window !== "undefined") {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            ...params,
        });
    }
};
