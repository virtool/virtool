import {fill, fromPairs, map, reduce, slice} from "lodash-es";

export const calculateQuartile = (values, quartile) => {
    const index = (values.length * quartile) / 4;

    if (index % 1 === 0) {
        return values[index].val;
    }

    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    return (values[lowerIndex].val + values[upperIndex].val) / 2;
};

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

export const removeOutlierByIQR = (values) => {

    const q1 = calculateQuartile(values, 1);
    const q3 = calculateQuartile(values, 3);

    const total = reduce(values, (sum, entry) => sum + entry.val, 0);
    const mean = total / values.length;

    const IQR = (q3 - q1);
    const outlierDifference = 1.5 * IQR;

    // Largest value not an outlier
    if ((values[values.length - 1].val - mean) <= outlierDifference) {
        return values;
    }

    return removeOutlierByIQR(slice(values, 0, values.length - 1));
};
