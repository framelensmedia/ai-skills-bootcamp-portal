import { useEffect, useState, useRef, MutableRefObject } from 'react';

export function useInView(options: IntersectionObserverInit = { root: null, rootMargin: '0px', threshold: 0.1 }) {
    const [isInView, setIsInView] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                // Optional: Disconnect if you want it to trigger only once
                // observer.disconnect();
            } else {
                // Determine behavior: unload when out of scroll? 
                // For videos: Yes. For images: Maybe keep it.
                // Let's make it real-time visibility for now.
                setIsInView(false);
            }
        }, options);

        observer.observe(element);

        return () => {
            if (element) observer.unobserve(element);
        };
    }, []); // eslint-ignore-line react-hooks/exhaustive-deps (options usually stable or ignored)

    return { ref, isInView };
}
