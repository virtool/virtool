import { useCallback, useEffect, useRef, useState } from "react";

const getSize = ref => ({
    height: ref.current ? ref.current.scrollHeight : 0,
    width: ref.current ? ref.current.scrollWidth : 0
});

export const useElementSize = () => {
    const ref = useRef(null);

    const [size, setSize] = useState(getSize(ref));

    const handleResize = useCallback(() => {
        setSize(getSize(ref));
    }, [ref]);

    useEffect(() => {
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [null]);

    return [ref, size];
};
