var CX = require('classnames');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

var NuVsEntry = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return nextProps.in !== this.props.in;
    },

    toggleIn: function () {
        this.props.toggleIn(this.props.index);
    },

    render: function () {

        var flexStyle = {
            height: "21px"
        };

        var className = CX({
            "list-group-item": true,
            "hoverable": !this.props.in,
            "spaced": true
        });

        var closeButton;

        if (this.props.in) {
            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
            );
        }

        return (
            <div className={className} onClick={this.props.in ? null: this.toggleIn}>
                <Row>
                    <Col md={3}>
                        <strong>Sequence {this.props.index}</strong>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center" style={flexStyle}>
                            <Flex.Item>
                                <Label>Length</Label>
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <strong className="text-primary">
                                    {this.props.sequence.length}
                                </strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center" style={flexStyle}>
                            <Flex.Item>
                                <Label>E-value</Label>
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                <strong className="text-danger">
                                    {this.props.minE}
                                </strong>
                            </Flex.Item>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex>
                            <Flex.Item grow={1} shrink={0}>
                                <Flex alignItems="center" style={flexStyle}>
                                    <Flex.Item>
                                        <Label>ORFs</Label>
                                    </Flex.Item>
                                    <Flex.Item pad={5}>
                                        <strong className="text-success">
                                            {this.props.orfs.length}
                                        </strong>
                                    </Flex.Item>
                                </Flex>
                            </Flex.Item>
                            <Flex.Item grow={0} shrink={0}>
                                {closeButton}
                            </Flex.Item>
                        </Flex>
                    </Col>
                </Row>
            </div>
        );
    }
});

module.exports = NuVsEntry;