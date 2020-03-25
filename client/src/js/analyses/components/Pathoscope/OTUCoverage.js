import { max } from "lodash-es";
import styled from "styled-components";
import { scaleLinear } from "d3-scale";
import { select } from "d3-selection";
import { area } from "d3-shape";
import PropTypes from "prop-types";
import React, { useEffect, useRef } from "react";
import { Flex } from "../../../base";

const createChart = (element, data, width) => {
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

    if (data) {
        const areaDrawer = area()
            .x((d, i) => x(i))
            .y0(d => y(d))
            .y1(height);

        svg.append("path").datum(data).attr("class", "depth-area").attr("d", areaDrawer);
    }
};

const StyledOTUCoverage = styled.div`
    path.depth-area {
        fill: ${props => props.theme.color.blue};
        stroke: ${props => props.theme.color.blue};
    }
`;

export const StaticOTUCoverage = ({ id, filled }) => {
    const el = useRef(null);
    useEffect(() => createChart(el.current, filled, el.current.scrollWidth), [id]);

    return <StyledOTUCoverage ref={el} />;
};

export default class OTUCoverage extends React.Component {
    static propTypes = {
        id: PropTypes.string,
        filled: PropTypes.array,
        resize: PropTypes.bool
    };

    componentDidMount() {
        window.addEventListener("resize", this.renderChart);
        this.renderChart();
    }

    shouldComponentUpdate(nextProps) {
        return this.props.id !== nextProps.id;
    }

    componentDidUpdate() {
        this.renderChart();
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.renderChart);
    }

    renderChart = () => {
        while (this.chartNode.firstChild) {
            this.chartNode.removeChild(this.chartNode.firstChild);
        }

        createChart(this.chartNode, this.props.filled, this.chartNode.scrollWidth);
    };

    render() {
        return (
            <Flex>
                <StyledOTUCoverage
                    style={{ display: "flex", flex: "1 0 auto" }}
                    ref={node => (this.chartNode = node)}
                />
            </Flex>
        );
    }
}
