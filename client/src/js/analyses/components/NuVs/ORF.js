import React from "react";
import PropTypes from "prop-types";
import { select } from "d3-selection";
import { scaleLinear } from "d3-scale";
import { Flex, FlexItem } from "../../../base/index";

const HEIGHT = 8;

export default class NuVsORF extends React.Component {
    static propTypes = {
        hits: PropTypes.arrayOf(PropTypes.object),
        maxSequenceLength: PropTypes.number,
        pos: PropTypes.array,
        strand: PropTypes.number
    };

    componentDidMount() {
        this.draw();
    }

    draw = () => {
        const element = this.containerNode;

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
        const x = scaleLinear()
            .range([0, width])
            .domain([0, this.props.maxSequenceLength]);

        const x0 = x(Math.abs(this.props.pos[this.props.strand === 1 ? 0 : 1]));
        const x1 = x(Math.abs(this.props.pos[this.props.strand === 1 ? 1 : 0]));
        const x2 = x1 + (this.props.strand === 1 ? -5 : 5);

        const yBase = HEIGHT - 4;

        const d = [
            `M${x0},${yBase + 2}`,
            `L${x2},${yBase + 2}`,
            `L${x1},${yBase}`,
            `L${x2},${yBase - 2}`,
            `L${x0},${yBase - 2}`
        ].join(" ");

        group
            .append("path")
            .attr("d", d)
            .attr("stroke-width", 1);
    };

    render() {
        const hmm = this.props.hits[0];

        let label;

        if (hmm) {
            label = (
                <a target="_blank" href={`/hmm/${hmm.hit}`} className="text-capitalize" rel="noopener noreferrer">
                    {hmm.names[0]}
                </a>
            );
        } else {
            label = <span>Unannotated</span>;
        }

        return (
            <div className="nuvs-item">
                <div className="nuvs-item-header">
                    <Flex>
                        <FlexItem>{label}</FlexItem>
                        <FlexItem pad={5}>
                            <small className="text-primary text-strong">{this.props.pos[1] - this.props.pos[0]}</small>
                        </FlexItem>
                        <FlexItem pad={5}>
                            <small className="text-danger text-strong">{hmm ? hmm.best_e : null}</small>
                        </FlexItem>
                    </Flex>
                </div>

                <div ref={node => (this.containerNode = node)} />
            </div>
        );
    }
}
