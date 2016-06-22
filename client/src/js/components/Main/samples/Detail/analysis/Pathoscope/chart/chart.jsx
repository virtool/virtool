var _ = require("lodash");
var d3 = require('d3');
var React = require("react");

var ChartContainer = require("virtool/js/components/Base/ChartContainer.jsx");
var Tooltip = require("!jsx!./tip.jsx");

function Chart(element, props) {

    this.props = props;

    // Set the consistent chart dimensions.
    this.margin = {
        top: 30,
        left: 20,
        bottom: 20,
        right: 20
    };

    this.width = element.offsetWidth - this.margin.left - this.margin.right;

    this.barHeight = 40;

    var dataLength = this.props.data.length;

    // Construct the SVG canvas.
    this.svg = d3.select(element).append('svg')
        .attr('width', this.width + this.margin.left + this.margin.right)
        .attr('height', this.barHeight * 1.2 * dataLength + this.margin.top + this.margin.bottom);

    // Create a mother group that will hold all chart elements.
    this.group = this.svg.append('g')
        .attr('transform', 'translate(' + this.margin.left + ',' + this.margin.top + ')');

    // Set-up a y-axis that will appear at the top of the chart.
    this.y = d3.scale.linear()
        .range([0, this.width])
        .domain([0, 1]);

    this.axis = this.group.append('g')
        .attr('class', 'y axis')
        .attr("transform", "translate(0, -5)");

    this.update = function (props) {

        this.props = props || this.props;

        props = this.props;
        var data = this.props.data;
        var y = this.y;
        var width = this.width;
        var barHeight = this.barHeight;
        var nextLevel = this.props.nextLevel;
        var select = this.props.select;

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("top");
        
        this.svg.attr("height", this.barHeight * 1.2 * data.length + this.margin.top + this.margin.bottom);

        var bars = this.group.selectAll(".bar-group")
            .data(data, function (d) {return d._id || d.isolate_id || d.accession});

        bars.attr("name", "old-bars");

        var newBars = bars.enter().append("g")
            .attr("class", "bar-group")
            .on("click", function (d) {
                var target = "_id";
                if (nextLevel === "isolate") {
                    target = "isolate_id";
                }
                select(nextLevel, d[target]);
            })
            .on("mouseenter", function (d) {
                props.handleEnterBarGroup(d, d3.event.pageX, d3.event.pageY);
            })
            .on("mouseleave", function () {
                props.handleLeaveBarGroup();
            });

        newBars.append("rect")
            .attr("class", "bar virus-bar negative")
            .attr("x", 0)
            .attr("width", y(1))
            .attr("y", function (d, i) {
                return barHeight * i * 1.2;
            })
            .attr("height", barHeight);

        // Draw bars representing coverage of the subject sequence.
        newBars.append("rect")
            .attr("class", "bar virus-bar coverage")
            .attr("name", "new-bars")
            .attr("x", 0)
            .attr("width", function (d) { return y(d.coverage)})
            .attr("y", function (d, i) {return barHeight * i * 1.2})
            .attr("height", barHeight / 2);

        // Draw bars representing weight of the subject sequence.
        newBars.append("rect")
            .attr("class", "bar virus-bar weight")
            .attr("x", 0)
            .attr("width", function (d) { return y(d.pi)})
            .attr("y", function (d, i) {
                return  barHeight * i * 1.2 + barHeight / 2;
            })
            .attr("height", barHeight / 2);

        newBars.append("text")
            .attr("class", "pointer virus-bar-label")
            .attr("dominant-baseline", "central")
            .attr("x", 4)
            .attr("y", function (d, i) { return (barHeight * i * 1.2) + (barHeight / 2)})
            .text(function (d) {return d.name || d.definition});

        bars.exit().remove();

        this.axis.call(yAxis);
    };

    this.update();
}

var Bars = React.createClass({

    getInitialState: function () {
        return {
            "x": null,
            "y": null,
            "barGroupData": null,
            "barGroupEntered": false,
            "tooltipEntered": false
        }
    },

    handleEnterBarGroup: function (barGroupData, x, y) {
        this.setState({
            "x": x,
            "y": y,
            "barGroupData": barGroupData,
            "barGroupEntered": true,
            "tooltipEntered": false
        });
    },

    handleLeaveBarGroup: function () {
        this.setState({
            "barGroupEntered": false
        });
    },

    handleEnterTooltip: function () {
        this.setState({
            "tooltipEntered": true
        });
    },

    handleExitTooltip: function () {
        this.setState({
            "tooltipEntered": false
        });
    },

    render: function () {

        var data = _.sortBy(this.props.data, 'pi').reverse();
        var nextLevel = "virus";

        // Use the level information to prepare the dataset. For instance, if the level is "isolate" each data item will
        // be a isolate sequence.
        if (this.props.virus) {
            data = _.find(data, {_id: this.props.virus}).isolates;
            nextLevel = "isolate";

            if (this.props.isolate) {
                data = _.find(data, {isolate_id: this.props.isolate}).hits;
                nextLevel = "sequence";
            }
        }

        var tooltip;

        if (this.props.query && (this.state.barGroupEntered || this.state.tooltipEntered)) {
            var tooltipProps = {
                "handleEnterTooltip": this.handleEnterTooltip,
                "handleExitTooltip": this.handleExitTooltip
            };

            tooltip = <Tooltip {...tooltipProps} {...this.state} />;
        }

        var containerProps = {
            handleEnterBarGroup: this.handleEnterBarGroup,
            handleLeaveBarGroup: this.handleLeaveBarGroup,
            chart: Chart,
            nextLevel: nextLevel,
            data: data
        };

        return (
            <div>
                {tooltip}
                <ChartContainer {...this.props} {...containerProps} />
            </div>
        )
    }
});

module.exports = Bars;