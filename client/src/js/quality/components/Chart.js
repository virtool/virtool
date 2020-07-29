import "d3-transition";
import React, { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const StyledQualityChart = styled.div`
    min-height: 385px;

    .axis path,
    .axis line {
        fill: none;
        stroke: ${props => props.theme.color.black};
        shape-rendering: crispEdges;
    }

    .axis-label {
        text-anchor: middle;
    }

    .graph-line {
        fill: none;
        shape-rendering: geometricPrecision;
        stroke-width: 2px;
    }

    .graph-line-blue {
        stroke: ${props => props.theme.color.blue};
    }

    .graph-line-green {
        stroke: ${props => props.theme.color.green};
    }

    .graph-line-yellow {
        stroke: ${props => props.theme.color.yellow};
    }

    .graph-line-red {
        stroke: ${props => props.theme.color.red};
    }

    .quality-area {
        stroke: none;
    }

    .quality-area-yellow {
        fill: ${props => props.theme.color.yellowLightest};
    }

    .quality-area-green {
        fill: ${props => props.theme.color.greenLightest};
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
