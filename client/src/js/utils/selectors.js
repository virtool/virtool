import { createSelector } from "reselect";

export const getTermSelectorFactory = selector => {
    return createSelector(
        [selector],
        term => {
            const url = new URL(window.location);
            return url.searchParams.get("find") || term;
        }
    );
};
