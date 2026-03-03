import { useEffect, useState, useRef, MutableRefObject } from 'react';

export function useInView(options: IntersectionObserverInit = { root: null, rootMargin: '0px', threshold: 0.1 }, triggerOnce: boolean = false) {
    const [isInView, setIsInView] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                if (triggerOnce) observer.disconnect();
            } else {
                if (!triggerOnce) setIsInView(false);
            }
        }, options);

        observer.observe(element);

        return () => {
            if (element) observer.unobserve(element);
        };
    }, []); // eslint-ignore-line react-hooks/exhaustive-deps (options usually stable or ignored)

    return { ref, isInView };
}
