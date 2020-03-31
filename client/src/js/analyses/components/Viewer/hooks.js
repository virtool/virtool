import { useCallback, useEffect, useRef } from "react";

export const useKeyNavigation = (activeId, nextId, nextIndex, previousId, previousIndex, scroll, onSetActiveId) => {
    const ref = useRef(null);

    const handleKeyPress = useCallback(
        e => {
            if (e.target !== window.document.body) {
                return;
            }

            if (e.key === "w" && previousIndex > -1) {
                if (scroll) {
                    ref.current.scrollToItem(previousIndex);
                }
                onSetActiveId(previousId);
            } else if (e.key === "s" && nextIndex > -1) {
                if (scroll) {
                    ref.current.scrollToItem(nextIndex);
                }
                onSetActiveId(nextId);
            }
        },
        [activeId, nextId, previousId]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyPress, true);
        return () => {
            window.removeEventListener("keydown", handleKeyPress, true);
        };
    });

    return ref;
};
