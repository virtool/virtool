import React, { useContext, useEffect, useRef } from "react";
import styled from "styled-components";
import { axisBottom, axisLeft } from "d3-axis";
import { format } from "d3-format";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { area } from "d3-shape";
import { PathoscopeDetailContext } from "./Detail";

const draw = (element, data, length, meta, yMax, xMin, onRendered) => {
    let svg = select(element).append("svg");

    const margin = {
        top: 10,
        left: 35,
        bottom: 50,
        right: 10
    };

    const height = 200 - margin.top - margin.bottom;

    let width = length > 800 ? length / 5 : length;

    if (width < xMin) {
        width = xMin;
    }

    width -= margin.left + margin.right;

    const x = scaleLinear().range([0, width]).domain([0, length]);

    const y = scaleLinear().range([height, 0]).domain([0, yMax]);

    select(element).selectAll("*").remove();

    // Construct the SVG canvas.
    svg = select(element)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    if (data) {
        const areaDrawer = area()
            .x(d => x(d[0]))
            .y0(d => y(d[1]))
            .y1(height);

        svg.append("path").datum(data).attr("class", "depth-area").attr("d", areaDrawer);
    }

    // Set-up a y-axis that will appear at the top of the chart.
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", `translate(0,${height})`)
        .call(axisBottom(x).ticks(10))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-0.8em")
        .attr("dy", "0.15em")
        .attr("transform", "rotate(-65)");

    svg.append("g")
        .attr("class", "y axis")
        .call(axisLeft(y).ticks(4).tickFormat(format(".0s")));

    svg.append("text")
        .attr("class", "coverage-label small")
        .attr("transform", "translate(4,10)")
        .text(`${meta.accession} - ${meta.definition}`);

    onRendered();
};

const StyledCoverageChart = styled.div`
    display: inline-block;
    margin-top: 5px;

    path.depth-area {
        fill: ${props => props.theme.color.blue};
        stroke: ${props => props.theme.color.blue};
    }
`;

export const CoverageChart = ({ accession, data, definition, id, length, yMax }) => {
    const chartEl = useRef(null);

    const { onRendered } = useContext(PathoscopeDetailContext);

    useEffect(() => {
        draw(
            chartEl.current,
            data,
            length,
            { accession, id, definition },
            yMax,
            chartEl.current.offsetWidth,
            onRendered
        );
    }, [id, onRendered]);

    return <StyledCoverageChart ref={chartEl} />;
};

export default CoverageChart;
