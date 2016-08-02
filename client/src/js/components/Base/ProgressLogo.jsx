/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ProgressLogo
 */

'use strict';

var d3 = require('d3');
var React = require("react");
var Popover = require('react-bootstrap/lib/Popover');
var OverlayTrigger = require('react-bootstrap/lib/OverlayTrigger');

var Icon = require('./Icon.jsx');

var twoPi = 2 * Math.PI;

var arcTween = function (newValue, arc) {

    return function (d) {
        var interpolate = d3.interpolate(d.endAngle, newValue * twoPi);

        return function (t) {
            d.endAngle = interpolate(t);
            return arc(d);
        }
    }

};

var ProgressLogo = React.createClass({

    propTypes: {
        value: React.PropTypes.number
    },

    componentDidMount: function () {

        var iconPath = "M 23.687382,0 22.569101,2.31177 18.50196,2.72175 17.227148,0.696502 14.408907,1.478328 14.713969,3.897543 11.286026,5.758252 9.3579,4.004358 6.864525,6.039086 8.299241,8.222553 5.83494,11.209128 3.415511,10.39275 1.84596,13.125033 3.974232,14.637071 2.798438,18.425272 0.257869,18.511862 0,22.044302 l 2.388458,0.44811 0.40998,4.067142 -2.127852,1.135976 1.187596,3.291214 2.11605,-0.638989 1.860708,3.427946 -1.710705,1.987748 1.951301,2.491687 2.223706,-1.492654 2.986785,2.464092 -0.57726,2.638743 2.393302,1.290617 1.6119,-2.068652 3.787991,1.176008 0.355838,2.610299 2.593023,0.12641 1.11828,-2.32673 4.067142,-0.409979 1.454943,2.207484 2.812763,-0.868415 -0.479501,-2.515077 3.427942,-1.860708 2.147231,1.750736 2.053058,-1.831635 -1.213508,-2.383193 2.464302,-2.986781 2.718382,1.055708 1.370253,-2.552787 -2.228136,-1.930867 1.176007,-3.788201 2.650119,-0.275989 0.126615,-2.872384 -2.366755,-0.918769 -0.409979,-4.067141 2.144699,-1.401217 -0.89938,-2.656864 -2.421326,0.26988 L 39.303473,11.209127 41.030614,9.151221 39.372368,7.090791 36.839172,8.222552 33.85239,5.758251 34.509285,2.999845 32.115979,1.94856 30.424448,3.897543 26.636243,2.72175 26.307585,0.166436 23.687382,0 Z m -16.453748,15.615671 4.028797,0 4.122548,11.472052 4.112014,-11.472052 4.028797,0 -5.756779,15.542565 -4.778388,0 -5.756989,-15.542565 z m 16.489984,0 14.324636,0 0,3.02934 -5.153186,0 0,12.513225 -4.00794,0 0,-12.513225 -5.16351,0 0,-3.02934 z";

        var height = 200;
        var width = 200;

        this.arc = d3.svg.arc()
            .startAngle(0)
            .innerRadius(50)
            .outerRadius(60);

        var svg = d3.select(".progress-logo-container").append("svg")
            .attr("height", height)
            .attr("width", width);

        var meter = svg.append("g")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

        svg.append("g")
            .attr("transform", "translate(" + 76.5 + "," + 76.5 + ")")
            .append("path")
            .attr("d", iconPath)
            .attr("fill", "black");

        meter.append("path")
            .datum({endAngle: twoPi})
            .style("fill", "#ddd")
            .attr("d", this.arc);

        this.foreground = meter.append("path")
            .datum({endAngle: this.props.value * twoPi})
            .style("stroke", "#337ab7")
            .style("fill", "#337ab7")
            .attr("d", this.arc);
    },

    shouldComponentUpdate: function (nextProps) {
        this.foreground.transition()
            .duration(50)
            .attrTween("d", arcTween(nextProps.value, this.arc));

        return false;
    },

    render: function () {
        return (
            <div className="progress-logo-container" />
        );
    }

});

module.exports = ProgressLogo;