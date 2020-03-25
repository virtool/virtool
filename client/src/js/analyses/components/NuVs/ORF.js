import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";

const HEIGHT = 8;

const draw = (element, maxLength, pos, strand) => {
    element.innerHTML = "";

    const width = element.offsetWidth - 30;

    // Construct the SVG canvas.
    const svg = select(element)
        .append("svg")
        .attr("width", width + 30)
        .attr("height", HEIGHT);

    // Create a mother group that will hold all chart elements.
    const group = svg.append("g").attr("transform", "translate(15,0)");

    // Set-up a y-axis that will appear at the top of the chart.
    const x = scaleLinear().range([0, width]).domain([0, maxLength]);

    const x0 = x(Math.abs(pos[strand === 1 ? 0 : 1]));
    const x1 = x(Math.abs(pos[strand === 1 ? 1 : 0]));
    const x2 = x1 + (strand === 1 ? -5 : 5);

    const yBase = HEIGHT - 4;

    const d = [
        `M${x0},${yBase + 2}`,
        `L${x2},${yBase + 2}`,
        `L${x1},${yBase}`,
        `L${x2},${yBase - 2}`,
        `L${x0},${yBase - 2}`
    ].join(" ");

    group.append("path").attr("d", d).attr("stroke-width", 1);
};

const NuVsORFHeader = styled.div`
    align-items: center;
    display: flex;
    padding: 10px 15px 0;

    small {
        margin-left: 5px;
    }
`;

const NuVsORFLabel = ({ hmm }) => {
    if (hmm) {
        return (
            <a target="_blank" href={`/hmm/${hmm.hit}`} className="text-capitalize" rel="noopener noreferrer">
                {hmm.names[0]}
            </a>
        );
    }
    return <span>Unannotated</span>;
};

const NuVsORF = ({ hits, index, maxSequenceLength, pos, strand }) => {
    const chartEl = useRef(null);

    useEffect(() => draw(chartEl.current, maxSequenceLength, pos, strand), [index]);

    const hmm = hits[0];

    return (
        <div>
            <NuVsORFHeader>
                <NuVsORFLabel hmm={hmm} />
                <small className="text-primary text-strong">{pos[1] - pos[0]}</small>
                <small className="text-danger text-strong">{hmm ? hmm.full_e : null}</small>
            </NuVsORFHeader>

            <div ref={chartEl} />
        </div>
    );
};

export default NuVsORF;
