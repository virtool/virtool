import { extent, histogram, max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { format } from "d3-format";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { fill, flatMap } from "lodash-es";
import React, { useEffect } from "react";
import styled from "styled-components";
import { useElementSize } from "../../../utils/hooks";

const draw = (element, data, width) => {
    const flattened = flatMap(data, ([x, y]) => fill(new Array(y), x));

    let svg = select(element).selectAll("*").remove().append("svg");

    const margin = {
        top: 10,
        left: 35,
        bottom: 50,
        right: 10
    };

    svg.remove();

    const height = 220 - margin.top - margin.bottom;
    const adjustedWidth = width - margin.left - margin.right;

    const x = scaleLinear().domain(extent(flattened)).nice().range([0, adjustedWidth]);

    const bins = histogram().domain(x.domain()).thresholds(x.ticks(80))(flattened);

    const y = scaleLinear()
        .domain([0, max(bins, d => d.length)])
        .range([height, 0]);

    // Construct the SVG canvas.
    svg = select(element)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.append("g")
        .selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("y", d => y(d.length))
        .attr("height", d => y(0) - y(d.length));

    const xAxis = axisBottom(x);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em")
        .attr("transform", "rotate(-65)");

    svg.append("g")
        .attr("class", "y axis")
        .call(axisLeft(y).ticks(4).tickFormat(format(".0s")));
};

const StyledHistogram = styled.div`
    width: 100%;

    rect {
        fill: ${props => props.theme.color.green};
    }
`;

export const Histogram = ({ data }) => {
    const [ref, size] = useElementSize();

    useEffect(() => draw(ref.current, data, size.width), [size.width]);

    return <StyledHistogram ref={ref} />;
};
