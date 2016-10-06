var _ = require("lodash");
var React = require('react');
var FlipMove = require('react-flip-move');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Grid = require('react-bootstrap/lib/Grid');
var Panel = require('react-bootstrap/lib/Panel');
var Alert = require('react-bootstrap/lib/Button');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var PathoscopeEntry = require("./Entry.jsx");

var PathoscopeList = React.createClass({

    propTypes: {
        data: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
    },

    render: function () {

        var rows = this.props.data.map(function (item) {
            return (
                <PathoscopeEntry
                    key={item._id}
                    {...item}
                    in={_.includes(this.props.expanded, item._id)}
                    toggleIn={this.props.toggleIn}
                />
            );
        }, this);

        return (
            <div style={{overflowY: "hidden"}}>
                <FlipMove typeName="div" className="list-group" leaveAnimation={false}>
                    {rows}
                </FlipMove>
            </div>
        );
    }

});

module.exports = PathoscopeList;