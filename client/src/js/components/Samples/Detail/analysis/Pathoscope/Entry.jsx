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
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var Utils = require('virtool/js/Utils');

var PathoscopeIsolate = require("./Isolate.jsx");

var PathoscopeEntry = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return this.props.in !== nextProps.in;
    },

    toggleIn: function () {
        this.props.toggleIn(this.props._id);
    },

    render: function () {

        var className = CX({
            "list-group-item": true,
            "hoverable": !this.props.in,
            "spaced": true
        });

        var closeButton;

        var isolateComponents;

        if (this.props.in) {
            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
            );

            isolateComponents = _.sortBy(this.props.isolates, "pi").reverse().map(function (isolate) {
                return (
                    <PathoscopeIsolate
                        key={isolate.isolate_id}
                        maxDepth={this.props.maxDepth}
                        maxGenomeLength={this.props.maxGenomeLength}
                        {...isolate}
                    />
                );
            }, this);

            isolateComponents = (
                <div style={{marginTop: "15px"}}>
                    {isolateComponents}
                </div>
            )
        }

        return (
            <div className={className} onClick={this.props.in ? null: this.toggleIn}>
                <Row>
                    <Col md={6}>
                        <Flex>
                            <Flex.Item>
                                {this.props.name}
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <small className="text-primary">
                                    <strong className="text-warning">
                                        {this.props.abbreviation}
                                    </strong>
                                </small>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center">
                            <Flex.Item>
                                <Label>Weight</Label>
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <strong className="text-success">
                                    {Utils.toScientificNotation(this.props.pi)}
                                </strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center">
                            <Flex.Item>
                                <Label>Best</Label>
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <strong className="text-danger">
                                    {Utils.toScientificNotation(this.props.best)}
                                </strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center">
                            <Flex.Item>
                                <Label>Coverage</Label>
                            </Flex.Item>
                            <Flex.Item grow={1} pad={5}>
                                <strong className="text-primary">
                                    {Utils.toScientificNotation(this.props.coverage)}
                                </strong>
                            </Flex.Item>
                            <Flex.Item>
                                {closeButton}
                            </Flex.Item>
                        </Flex>
                    </Col>
                </Row>
                {isolateComponents}
            </div>
        );

    }

});

module.exports = PathoscopeEntry;

