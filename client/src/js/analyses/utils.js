import {compact, fill, flatMap, fromPairs, map, max, maxBy, mean, round, sortBy, sum, sumBy} from "lodash-es";
import {formatIsolateName} from "../utils";

export const fillAlign = ({ align, length }) => {
    const filled = Array(length - 1);

    if (!align) {
        return fill(Array(length - 1), 0);
    }

    const coords = fromPairs(align);

    let prev = 0;

    return map(filled, (depth, i) => {
        const next = coords[i];

        if (next) {
            prev = next;
        }

        return prev;
    });
};

export const median = (values) => {
    const midIndex = (values.length - 1) / 2;

    if (midIndex % 1 === 0) {
        return values[midIndex];
    }

    const lowerIndex = Math.floor(midIndex);
    const upperIndex = Math.ceil(midIndex);

    return (values[lowerIndex] + values[upperIndex]) / 2;
};
