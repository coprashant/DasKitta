import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export function useClock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return now;
}

export function useDragScroll() {
    const ref = useRef(null);
    const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

    const onPointerDown = useCallback((e) => {
        const el = ref.current;
        if (!el) return;
        dragRef.current = {
            active: true,
            startX: e.pageX - el.offsetLeft,
            scrollLeft: el.scrollLeft,
        };
        el.setPointerCapture?.(e.pointerId);
    }, []);

    const onPointerUp = useCallback((e) => {
        dragRef.current.active = false;
        try {
            ref.current?.releasePointerCapture?.(e.pointerId);
        } catch {
            return;
        }
    }, []);

    const onPointerMove = useCallback((e) => {
        const el = ref.current;
        const drag = dragRef.current;
        if (!el || !drag.active) return;
        const x = e.pageX - el.offsetLeft;
        el.scrollLeft = drag.scrollLeft - (x - drag.startX) * 1.5;
    }, []);

    const handlers = useMemo(
        () => ({
            onPointerDown,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onPointerMove,
        }),
        [onPointerDown, onPointerUp, onPointerMove]
    );

    return { ref, handlers };
}
