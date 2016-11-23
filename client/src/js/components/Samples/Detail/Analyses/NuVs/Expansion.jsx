var d3 = require('d3');
var React = require('react');
var ReactDOM = require('react-dom');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

var NuVsORF = require('./ORF.jsx');
var NuVsBLAST = require('./BLAST.jsx');

var NuVsExpansion = React.createClass({

    componentDidMount: function () {
        this.draw();
    },

    draw: function () {

        var element = ReactDOM.findDOMNode(this.refs.container);

        element.innerHTML = '';

        window.test = element;

        var width = element.offsetWidth;

        // Set-up a y-axis that will appear at the top of the chart.
        var x = d3.scaleLinear()
            .range([0, width - 30])
            .domain([0, this.props.maxSequenceLength]);

        // Construct the SVG canvas.
        var svg = d3.select(element).append('svg')
            .attr('width', width)
            .attr('height', 26);

        // Create a mother group that will hold all chart elements.
        var group = svg.append('g')
            .attr('transform', 'translate(15,0)');

        group.append('rect')
            .attr('x', 0)
            .attr('y', 18)
            .attr('width', x(this.props.sequence.length))
            .attr('height', 8);

        var xAxis = d3.axisTop(x);

        var axis = group.append('g')
            .attr('class', 'x axis')
            .attr("transform", "translate(0,16)")
            .call(xAxis);

    },

    render: function () {

        var orfComponents = this.props.orfs.map(function (orf, index) {
            return (
                <NuVsORF
                    key={index}
                    {...orf}
                    maxSequenceLength={this.props.maxSequenceLength}
                />
            );
        }, this);

        return (
            <ListGroupItem className="pathoscope-virus-detail spaced">

                <div className="nuvs-layout">
                    <div className="nuvs-item nuvs-sequence">
                        <div ref="container" />
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
});

module.exports = NuVsExpansion;