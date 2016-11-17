var d3 = require("d3");
var React = require("react");
var ReactDOM = require("react-dom");

var Diagram = {};

Diagram.Sequence = React.createClass({

    componentDidMount: function () {
        window.onresize = this.draw;
        this.draw();
    },
    componentDidUpdate: function () {
        this.draw();
    },

    componentWillUnmount: function () {
        window.removeEventListener('resize', this.draw);
    },

    draw: function () {

        var element = ReactDOM.findDOMNode(this.refs.container);

        element.innerHTML = '';

        window.test = element;

        var margin = {
            top: 15,
            left: 15,
            bottom: 25,
            right: 15
        };

        var baseHeight = 43 + 30 * this.props.orfs.length;

        var width = element.offsetWidth - margin.left - margin.right;
        var height = baseHeight - margin.top - margin.bottom;

        // Construct the SVG canvas.
        var svg = d3.select(element).append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', baseHeight);

        // Create a mother group that will hold all chart elements.
        var group = svg.append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        // Set-up a y-axis that will appear at the top of the chart.
        var x = d3.scaleLinear()
            .range([0, width])
            .domain([0, this.props.maxSequenceLength]);

        var xAxis = d3.axisBottom(x);

        var axis = group.append('g')
            .attr('class', 'x axis')
            .attr("transform", "translate(0, " + (height) + ")");

        group.append('rect')
            .attr('x', 0)
            .attr('y', height - 10)
            .attr('width', x(this.props.sequence.length))
            .attr('height', 8);

        var orfs = group.selectAll('.orf-bar')
            .data(this.props.orfs);

        var subGroups = orfs.enter().append('g')
            .attr('class', function (d) {return 'orf-bar' + (d.hmms.length > 0 ? ' active' : '');})

        subGroups.append('rect')
            .attr('class', 'orf-bar-background')
            .attr('x', 0)
            .attr('y', function (d, i) {return height -  40 - (i * 30);})
            .attr('width', width)
            .attr('height', 30);

        subGroups.append('path')
            .attr('d', function (d, i) {
                var x0 = x(Math.abs(d.pos[d.strand === 1 ? 0: 1]));
                var x1 = x(Math.abs(d.pos[d.strand === 1 ? 1: 0]));

                var x2 = x1 + (d.strand === 1 ? -5: 5);

                var yBase = height - 36 - (30 * i);

                return [
                    "M" + x0 + "," + (yBase + 2),
                    "L" + x2 + "," + (yBase + 2),
                    "L" + x1 + "," + yBase,
                    "L" + x2 + "," + (yBase - 2),
                    "L" + x0 + "," + (yBase - 2)
                ].join(" ");
            })
            .attr('stroke-width', 1);

        subGroups.append('text')
            .attr('x', function (d) {
                return d.strand === 1 ? x(_.max(d.pos)): x(_.min(d.pos)) + 10;
            })
            .attr('y', function (d, i) { return height - 18 - (i * 30); })
            .attr('text-anchor', function (d) {
                return d.strand === 1 ? 'end': 'start'
            })
            .text(function (d) {
                return d.hmms.length > 0 ? d.hmms[0].label: 'Unannotated'
            });

        axis.call(xAxis);

    },
    
    render: function () {
        var divStyle = {
            height: 43 + 30 * this.props.orfs.length
        };

        return (
            <div ref='container' style={divStyle} />
        );
    }

});

module.exports = Diagram;


