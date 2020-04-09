import { max } from "lodash-es";
import styled from "styled-components";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { area } from "d3-shape";
import PropTypes from "prop-types";
import React, { useLayoutEffect } from "react";
import { useElementSize } from "../../../utils/hooks";

const draw = (element, data, width) => {
    const margin = {
        top: 10,
        left: 15,
        bottom: 10,
        right: 15
    };

    const yMax = max(data);

    const length = data.length;

    const height = 60 - margin.top - margin.bottom;

    width -= 30;

    const x = scaleLinear().range([0, width]).domain([0, length]);
    const y = scaleLinear().range([height, 0]).domain([0, yMax]);

    select(element).selectAll("*").remove();

    // Construct the SVG canvas.
    const svg = select(element)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const areaDrawer = area()
        .x((d, i) => x(i))
        .y0(d => y(d))
        .y1(height);

    svg.append("path").datum(data).attr("class", "depth-area").attr("d", areaDrawer);
};

const StyledOTUCoverage = styled.div`
    path.depth-area {
        fill: ${props => props.theme.color.blue};
        stroke: ${props => props.theme.color.blue};
    }
`;

export const OTUCoverage = ({ filled }) => {
    const [ref, { width }] = useElementSize();
    useLayoutEffect(() => draw(ref.current, filled, width));
    return <StyledOTUCoverage ref={ref} />;
};

OTUCoverage.propTypes = {
    filled: PropTypes.arrayOf(PropTypes.number).isRequired
};
