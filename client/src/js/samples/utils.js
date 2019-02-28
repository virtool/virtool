import { forEach } from "lodash-es";

export const setAlgorithmParameters = (url, algorithm, conditions) => {
    if (conditions.length === 0 || conditions.length === 3) {
        url.searchParams.delete(algorithm);
    } else {
        url.searchParams.set(algorithm, conditions);
    }
};

export const createFindURL = (term, pathoscope, nuvs) => {
    const url = new window.URL(window.location);

    if (term !== undefined) {
        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find");
        }
    }

    setAlgorithmParameters(url, "pathoscope", pathoscope);
    setAlgorithmParameters(url, "nuvs", nuvs);

    return url;
};
