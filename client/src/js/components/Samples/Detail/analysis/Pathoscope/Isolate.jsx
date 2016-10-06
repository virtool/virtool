var CX = require("classnames");
var React = require('react');
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

var Coverage = require('./coverage.jsx');
var Utils = require('virtool/js/Utils');

var PathoscopeIsolate = React.createClass({

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
                    yMax={this.props.maxDepth}
                    showYAxis={index === 0}
                    isolateComponent={this}
                />
            );
        }, this);

        return (
            <div>
                <div className="pathoscope-isolate-header">
                    <Flex>
                        <Flex.Item>
                            {this.props.name}
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-success">
                                {Utils.toScientificNotation(this.props.pi)}
                            </strong>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <strong className="small text-primary">
                                {Utils.toScientificNotation(this.props.coverage)}
                            </strong>
                        </Flex.Item>
                    </Flex>
                </div>
                <div style={chartContainerStyle}>
                    {hitComponents}
                </div>
            </div>
        );

    }

});

module.exports = PathoscopeIsolate;

