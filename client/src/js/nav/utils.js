import { includes, startsWith } from "lodash-es";

export const excludePaths = (paths = []) => {
    return function (match, location) {
        if (includes(paths, location.pathname)) {
            return false;
        }

        return !!match;
    };
};

export const isHomeActive = (match, location) => location.pathname === "/" || startsWith(location.pathname, "/home");
