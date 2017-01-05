import * as d3 from "d3";
import React from "react";
import { min, max } from "lodash";

const margin = {
    top: 15,
    left: 15,
    bottom: 25,
    right: 15
};

export default class SequenceDiagram extends React.Component {

    static propTypes = {
        orfs: React.PropTypes.array,
        sequence: React.PropTypes.string,
        maxSequenceLength: React.PropTypes.number
    };

    componentDidMount () {
        window.onresize = this.draw;
        this.draw();
    }

    componentDidUpdate () {
        this.draw();
    }

    componentWillUnmount () {
        window.removeEventListener("resize", this.draw);
    }

    draw = () => {

        const element = this.containerNode;

        element.innerHTML = "";

        window.test = element;

        const baseHeight = 43 + 30 * this.props.orfs.length;

        let width = element.offsetWidth - margin.left - margin.right;
        let height = baseHeight - margin.top - margin.bottom;

        // Construct the SVG canvas.
        let svg = d3.select(element).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", baseHeight);

        // Create a mother group that will hold all chart elements.
        let group = svg.append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // Set-up a y-axis that will appear at the top of the chart.
        const x = d3.scaleLinear()
            .range([0, width])
            .domain([0, this.props.maxSequenceLength]);

        const xAxis = d3.axisBottom(x);

        const axis = group.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0, " + (height) + ")");

        group.append("rect")
            .attr("x", 0)
            .attr("y", height - 10)
            .attr("width", x(this.props.sequence.length))
            .attr("height", 8);

        const orfs = group.selectAll(".orf-bar")
            .data(this.props.orfs);

        let subGroups = orfs.enter().append("g")
            .attr("class", d => `orf-bar${d.hmms.length > 0 ? " active" : ""}`);

        subGroups.append("rect")
            .attr("class", "orf-bar-background")
            .attr("x", 0)
            .attr("y", (d, i) => height -  40 - (i * 30))
            .attr("width", width)
            .attr("height", 30);

        subGroups.append("path")
            .attr("stroke-width", 1)
            .attr("d", (d, i) => {
                const x0 = x(Math.abs(d.pos[d.strand === 1 ? 0: 1]));
                const x1 = x(Math.abs(d.pos[d.strand === 1 ? 1: 0]));
                const x2 = x1 + (d.strand === 1 ? -5: 5);

                const yBase = height - 36 - (30 * i);

                return [
                    "M" + x0 + "," + (yBase + 2),
                    "L" + x2 + "," + (yBase + 2),
                    "L" + x1 + "," + yBase,
                    "L" + x2 + "," + (yBase - 2),
                    "L" + x0 + "," + (yBase - 2)
                ].join(" ");
            });


        subGroups.append("text")
            .attr("x", d => d.strand === 1 ? x(max(d.pos)): x(min(d.pos)) + 10)
            .attr("y", (d, i) => height - 18 - (i * 30))
            .attr("text-anchor", d => d.strand === 1 ? "end": "start")
            .text(d => d.hmms.length > 0 ? d.hmms[0].label: "Unannotated");

        axis.call(xAxis);

    };
    
    render = () => (
        <div ref={this.containerNode} style={{height: 43 + 30 * this.props.orfs.length}} />
    );

}
