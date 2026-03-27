import { useEffect, useRef } from "react";
import useCartStore, { CartItem } from "store";

const useOnItemAdded = (callback: (item: CartItem) => void) => {
    const items = useCartStore((state) => state.items);
    const mountedRef = useRef(false);
    const prevLengthRef = useRef(items.length);

    useEffect(() => {
        // pomiń pierwsze uruchomienie (hydration z persist)
        if (!mountedRef.current) {
            mountedRef.current = true;
            prevLengthRef.current = items.length;
            return;
        }

        const latest = items.at(-1);
        if (latest) callback(latest);

        prevLengthRef.current = items.length;
    }, [items]);
};

export default useOnItemAdded;