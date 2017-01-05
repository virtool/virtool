var _ = require('lodash');
var d3 = require('d3');
var React = require('react');
var ReactDOM = require('react-dom');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

var NuVsORF = React.createClass({

    componentDidMount: function () {
        this.draw();
    },

    draw: function () {

        var element = ReactDOM.findDOMNode(this.refs.container);

        element.innerHTML = '';

        var width = element.offsetWidth - 30;
        var height = 8;

        // Construct the SVG canvas.
        var svg = d3.select(element).append('svg')
            .attr('width', width + 30)
            .attr('height', height);

        // Create a mother group that will hold all chart elements.
        var group = svg.append('g')
            .attr('transform', 'translate(15,0)');

        // Set-up a y-axis that will appear at the top of the chart.
        var x = d3.scaleLinear()
            .range([0, width])
            .domain([0, this.props.maxSequenceLength]);

        var x0 = x(Math.abs(this.props.pos[this.props.strand === 1 ? 0: 1]));
        var x1 = x(Math.abs(this.props.pos[this.props.strand === 1 ? 1: 0]));

        var x2 = x1 + (this.props.strand === 1 ? -5: 5);

        var yBase = height - 4;

        var d = [
            "M" + x0 + "," + (yBase + 2),
            "L" + x2 + "," + (yBase + 2),
            "L" + x1 + "," + yBase,
            "L" + x2 + "," + (yBase - 2),
            "L" + x0 + "," + (yBase - 2)
        ].join(" ");

        group.append('path')
            .attr('d', d)
            .attr('stroke-width', 1);
    },

    render: function () {

        var hmm;

        if (this.props.hasHmm) {
            hmm = this.props.hmms[0];
        } else {
            hmm = {
                label: "Unannotated",
                best_e: "N/A",
                family: "N/A"
            }
        }

        return (
            <div className="nuvs-item">
                <div className="nuvs-item-header">
                    <Flex>
                        <Flex.Item>
                            {_.capitalize(hmm.label)}
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <small className="text-primary text-strong">
                                {this.props.nuc.length}
                            </small>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <small className="text-danger text-strong">
                                {hmm.best_e}
                            </small>
                        </Flex.Item>
                    </Flex>
                </div>

                <div ref='container' />
            </div>
        );
    }
});

module.exports = NuVsORF;