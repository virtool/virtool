import { scaleOrdinal } from "d3-scale";
import { select } from "d3-selection";
import { symbol, symbolSquare } from "d3-shape";
import { legendColor } from "d3-svg-legend";
import { map } from "lodash-es";

const height = 300;

const margin = {
    top: 20,
    left: 60,
    bottom: 60,
    right: 20
};

export const appendLegend = (svg, width, series) => {
    const legendScale = scaleOrdinal().domain(map(series, "label")).range(map(series, "color"));

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
    select(element).selectAll("*").remove();

    const svg = select(element)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    svg.margin = margin;
    svg.height = height;

    return svg;
};
