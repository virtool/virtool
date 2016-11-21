var React = require('react');
var ReactDOM = require("react-dom");
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Badge = require('react-bootstrap/lib/Badge');
var Label = require('react-bootstrap/lib/Label');
var Collapse = require('react-bootstrap/lib/Collapse');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Scroll = require('virtool/js/components/Base/Scroll.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Coverage = require('./Coverage.jsx');
var Utils = require('virtool/js/Utils');

var PathoscopeIsolate = React.createClass({

    componentDidMount: function () {
        ReactDOM.findDOMNode(this.refs.chart).addEventListener("scroll", this.handleScroll);
    },

    componentWillUnmount: function () {
        ReactDOM.findDOMNode(this.refs.chart).removeEventListener("scroll", this.handleScroll);
    },

    scrollTo: function (scrollLeft) {
        ReactDOM.findDOMNode(this.refs.chart).scrollLeft = scrollLeft;
    },

    handleScroll: function (event) {
        this.props.setScroll(this.props.virusId, event.target.scrollLeft);
    },

    render: function () {

        var chartContainerStyle = {
            overflowX: "scroll",
            whiteSpace: "nowrap"
        };

        var sorted = this.props.hits.sort(function (hit) {
            return hit.align.length;
        });

        var hitComponents = sorted.map(function (hit, index) {
            return (
                <Coverage
                    key={hit.accession}
                    data={hit.align}
                    accession={hit.accession}
                    definition={hit.definition}
                    yMax={this.props.maxDepth}
                    showYAxis={index === sorted.length - 1}
                    isolateComponent={this}
                />
            );
        }, this);

        var piValue = this.props.showReads ? this.props.reads: Utils.toScientificNotation(this.props.pi);

        return (
            <div>
                <div className="pathoscope-isolate-header">
                    <Flex>
                        <Flex.Item>
                            {this.props.name}
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-success">
                                {piValue}
                            </strong>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-danger">
                                {Utils.toScientificNotation(this.props.best)}
                            </strong>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-primary">
                                {Utils.toScientificNotation(this.props.coverage)}
                            </strong>
                        </Flex.Item>
                    </Flex>
                </div>
                <div ref="chart" style={chartContainerStyle}>
                    {hitComponents}
                </div>
            </div>
        );

    }

});

module.exports = PathoscopeIsolate;

