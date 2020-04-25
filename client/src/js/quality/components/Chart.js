import "d3-transition";
import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const StyledQualityChart = styled.div`
    min-height: 385px;

    .axis path,
    .axis line {
        fill: none;
        stroke: #000;
        shape-rendering: crispEdges;
    }

    .axis-label {
        text-anchor: middle;
    }

    .graph-line {
        fill: none;
        stroke: ${props => props.theme.color.blue};
        stroke-width: 2px;
    }
`;

export const QualityChart = ({ createChart, data, width }) => {
    const ref = useRef(null);
    useEffect(() => createChart(ref.current, data, width), [width]);
    return <StyledQualityChart ref={ref} />;
};

QualityChart.propTypes = {
    createChart: PropTypes.func.isRequired,
    data: PropTypes.array.isRequired,
    width: PropTypes.number.isRequired
};
