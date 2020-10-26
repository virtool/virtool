import { includes } from "lodash-es";

export const excludePaths = (paths = []) => {
    return function (match, location) {
        if (includes(paths, location.pathname)) {
            return false;
        }

        return !!match;
    };
};
