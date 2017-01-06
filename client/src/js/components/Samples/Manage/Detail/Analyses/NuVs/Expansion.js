import * as d3 from "d3";
import React from "react";
import { ListGroupItem } from "virtool/js/components/Base";

import NuVsORF from "./ORF";
import NuVsBLAST from "./BLAST";

export default class NuVsExpansion extends React.Component {

    static propTypes = {
        index: React.PropTypes.number,
        analysisId: React.PropTypes.string,
        blast: React.PropTypes.object,
        orfs: React.PropTypes.arrayOf(React.PropTypes.object),
        sequence: React.PropTypes.string,
        maxSequenceLength: React.PropTypes.number
    };

    componentDidMount () {
        this.draw();
    }

    shouldComponentUpdate = () => false;

    draw = () => {

        const element = this.containerNode;

        element.innerHTML = "";

        const width = element.offsetWidth;

        // Set-up a y-axis that will appear at the top of the chart.
        const x = d3.scaleLinear()
            .range([0, width - 30])
            .domain([0, this.props.maxSequenceLength]);

        // Construct the SVG canvas.
        let svg = d3.select(element).append("svg")
            .attr("width", width)
            .attr("height", 26);

        // Create a mother group that will hold all chart elements.
        let group = svg.append("g")
            .attr("transform", "translate(15,0)");

        group.append("rect")
            .attr("x", 0)
            .attr("y", 18)
            .attr("width", x(this.props.sequence.length))
            .attr("height", 8);

        group.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0,16)")
            .call(d3.axisTop(x));
    };

    render () {

        const orfComponents = this.props.orfs.map((orf, index) =>
            <NuVsORF
                key={index}
                {...orf}
                maxSequenceLength={this.props.maxSequenceLength}
            />
        );

        return (
            <ListGroupItem className="pathoscope-virus-detail spaced">

                <div className="nuvs-layout">
                    <div className="nuvs-item nuvs-sequence">
                        <div ref={(node) => this.containerNode = node} />
                    </div>
                    <div className="nuvs-orfs">
                        {orfComponents}
                    </div>
                </div>

                <NuVsBLAST
                    analysisId={this.props.analysisId}

                    blast={this.props.blast}

                    sequenceIndex={this.props.index}
                    sequence={this.props.sequence}
                />

            </ListGroupItem>
        );
    }
}
