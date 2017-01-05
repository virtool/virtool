import * as d3 from "d3";
import React from "react";
import { capitalize } from "lodash-es";
import { Flex, FlexItem } from "virtool/js/components/Base";

const DEFAULT_HMM = {
    label: "Unannotated",
    best_e: "N/A",
    family: "N/A"
};

const HEIGHT = 8;

export default class NuVsORF extends React.Component {

    static propTypes = {
        nuc: React.PropTypes.string,
        hmms: React.PropTypes.arrayOf(React.PropTypes.object),
        maxSequenceLength: React.PropTypes.number,
        hasHmm: React.PropTypes.bool,
        pos: React.PropTypes.array,
        strand: React.PropTypes.number,
    };

    componentDidMount = () => this.draw();

    shouldComponentUpdate = () => false;

    draw = () => {

        const element = this.containerNode;

        element.innerHTML = "";

        const width = element.offsetWidth - 30;

        // Construct the SVG canvas.
        const svg = d3.select(element).append("svg")
            .attr("width", width + 30)
            .attr("height", HEIGHT);

        // Create a mother group that will hold all chart elements.
        const group = svg.append("g")
            .attr("transform", "translate(15,0)");

        // Set-up a y-axis that will appear at the top of the chart.
        const x = d3.scaleLinear()
            .range([0, width])
            .domain([0, this.props.maxSequenceLength]);

        const x0 = x(Math.abs(this.props.pos[this.props.strand === 1 ? 0: 1]));
        const x1 = x(Math.abs(this.props.pos[this.props.strand === 1 ? 1: 0]));
        const x2 = x1 + (this.props.strand === 1 ? -5: 5);

        const yBase = HEIGHT - 4;

        const d = [
            "M" + x0 + "," + (yBase + 2),
            "L" + x2 + "," + (yBase + 2),
            "L" + x1 + "," + yBase,
            "L" + x2 + "," + (yBase - 2),
            "L" + x0 + "," + (yBase - 2)
        ].join(" ");

        group.append("path")
            .attr("d", d)
            .attr("stroke-width", 1);
    };

    render () {

        const hmm = this.props.hasHmm ? this.props.hmms[0]: DEFAULT_HMM;

        return (
            <div className="nuvs-item">
                <div className="nuvs-item-header">
                    <Flex>
                        <FlexItem>
                            {capitalize(hmm.label)}
                        </FlexItem>
                        <FlexItem pad={5}>
                            <small className="text-primary text-strong">
                                {this.props.nuc.length}
                            </small>
                        </FlexItem>
                        <FlexItem pad={5}>
                            <small className="text-danger text-strong">
                                {hmm.best_e}
                            </small>
                        </FlexItem>
                    </Flex>
                </div>

                <div ref={this.containerNode} />
            </div>
        );
    }
}
