var React = require('react');

var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var Report = React.createClass({

    render: function () {
        return (
            <ListGroupItem>
                <h5>Sequence {this.props.index}</h5>
            </ListGroupItem>
        );
    }

});

module.exports = Report;