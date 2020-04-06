import React, { useEffect, useRef } from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import { axisTop } from "d3-axis";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { getMaxSequenceLength } from "../../selectors";

const draw = (element, maxLength, sequenceLength) => {
    element.innerHTML = "";

    const width = element.offsetWidth;

    // Set-up a y-axis that will appear at the top of the chart.
    const x = scaleLinear()
        .range([0, width - 30])
        .domain([0, maxLength]);

    // Construct the SVG canvas.
    const svg = select(element).append("svg").attr("width", width).attr("height", 30);

    // Create a group that will hold all chart elements.
    const group = svg.append("g").attr("transform", "translate(15,3)");

    group.append("rect").attr("x", 0).attr("y", 18).attr("width", x(sequenceLength)).attr("height", 8);

    group.append("g").attr("class", "x axis").attr("transform", "translate(0,16)").call(axisTop(x));
};

const StyledNuVsSequence = styled.div`
    height: 32px;
    margin: 10px 0;
`;

const NuVsSequence = ({ maxSequenceLength, sequence, width }) => {
    const chartEl = useRef(null);

    useEffect(() => draw(chartEl.current, maxSequenceLength, sequence.length), [sequence, width]);

    return (
        <div style={{ overflow: "hidden" }}>
            <StyledNuVsSequence ref={chartEl} />
        </div>
    );
};

const mapStateToProps = state => ({
    maxSequenceLength: getMaxSequenceLength(state)
});

export default connect(mapStateToProps)(NuVsSequence);
