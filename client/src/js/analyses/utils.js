import {concat, forEach, map, range, reduce, slice} from "lodash-es";

export const calculateQuartile = (values, quartile) => {
    const index = (values.length * quartile) / 4;

    if (index % 1 === 0) {
        return values[index].val;
    }

    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    return (values[lowerIndex].val + values[upperIndex].val) / 2;
};

export const fillEntries = (alignArray) => {
    let filledEntries = [];

    forEach(alignArray, (entry, i) => {

        if (i === alignArray.length - 1) {

            const lastIndex = alignArray[i - 1][0];

            const numBasesToEnd = entry[0] - lastIndex;

            const fill = map(range(numBasesToEnd), (item, k) => (
                {key: (lastIndex + k), val: alignArray[i - 1][1]}
            ));

            fill.push({key: entry[0], val: entry[1]});

            return filledEntries = concat(filledEntries, fill);

        } else if (i !== 0) {
            const numBasesFromLastEntry = (alignArray[i][0] - alignArray[i - 1][0]);

            const fill = map(range(numBasesFromLastEntry), (item, j) => (
                {key: (alignArray[i - 1][0] + j), val: alignArray[i - 1][1]}
            ));

            return filledEntries = concat(filledEntries, fill);
        }
    });

    return filledEntries;
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

