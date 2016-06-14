var React = require('react');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Utils = require('virtool/js/Utils');

var Report = React.createClass({

    getInitialState: function () {
        return {
            expanded: false
        };
    },

    toggle: function () {
        this.setState({expanded: !this.state.expanded});
    },

    render: function () {
        return (
            <ListGroupItem>
                <Row>
                    <Col md={6}>
                        {this.props.definition}
                    </Col>
                    <Col md={1} />
                    <Col md={2}>
                        {Utils.toScientificNotation(this.props.full_e)}
                    </Col>
                    <Col md={2}>
                        {this.props.full_score}
                    </Col>
                    <Col md={1}>
                        {Object.keys(this.props.families).length}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }

});

module.exports = Report;