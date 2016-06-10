var Numeral = require('numeral');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var ReadItem = React.createClass({

    propTypes: {
        _id: React.PropTypes.string.isRequired,
        size: React.PropTypes.number.isRequired,
        onSelect: React.PropTypes.func.isRequired,
        selected: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            selected: false
        };
    },

    handleSelect: function () {
        this.props.onSelect(this.props._id);
    },

    render: function () {
        return (
            <ListGroupItem onClick={this.handleSelect} active={this.props.selected}>
                <Row>
                    <Col md={8}>
                        <Icon name='file' /> {this.props._id}
                    </Col>
                    <Col md={4}>
                        {Numeral(this.props.size).format(' 0.0 b')}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }

});

module.exports = ReadItem;