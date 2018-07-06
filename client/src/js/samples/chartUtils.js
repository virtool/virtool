import { select } from "d3-selection";
import { map, slice, reduce, forEach, range, concat } from "lodash-es";
import { symbol, symbolSquare } from "d3-shape";
import { scaleOrdinal } from "d3-scale";
import { legendColor } from "d3-svg-legend";

const height = 300;

const margin = {
    top: 20,
    left: 60,
    bottom: 60,
    right: 20
};

export const appendLegend = (svg, width, series) => {

    const legendScale = scaleOrdinal()
        .domain(map(series, "label"))
        .range(map(series, "color"));

    const legend = legendColor()
        .shape("path", symbol().type(symbolSquare).size(150)())
        .shapePadding(10)
        .scale(legendScale);

    // Append legend, calling rendering function.
    svg.append("g")
        .attr("class", "legendOrdinal")
        .attr("transform", `translate(${width - 60}, 5)`)
        .call(legend);
};


export const createSVG = (element, width) => {

    const svg = select(element).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    svg.margin = margin;
    svg.height = height;

    return svg;
};

export const fillEntries = (alignArray) => {
    let filledEntries = [];

    forEach(alignArray, (entry, i) => {

        if (i === alignArray.length - 1) {

            const lastIndex = alignArray[i - 1][0];

            const numBasesToEnd = entry[0] - lastIndex;

            const fill = map(range(numBasesToEnd), (item, k) => (
                { key: (lastIndex + k), val: alignArray[i - 1][1] }
            ));

            fill.push({ key: entry[0], val: entry[1] });

            return filledEntries = concat(filledEntries, fill);

        } else if (i !== 0) {
            const numBasesFromLastEntry = (alignArray[i][0] - alignArray[i - 1][0]);

            const fill = map(range(numBasesFromLastEntry), (item, j) => (
                { key: (alignArray[i - 1][0] + j), val: alignArray[i - 1][1] }
            ));

            return filledEntries = concat(filledEntries, fill);
        }
    });

    return filledEntries;
};

export const getQuartileValue = (values, quartile) => {
    const index = (values.length * quartile) / 4;

    if (index % 1 === 0) {
        return values[index].val;
    }

    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    return (values[lowerIndex].val + values[upperIndex].val) / 2;
};

export const removeOutlierByIQR = (values) => {

    const q1 = getQuartileValue(values, 1);
    const q3 = getQuartileValue(values, 3);
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
