import React from "react";
var ListGroup = require('react-bootstrap/lib/ListGroup');
var SequenceItem = require('./Item');

var Report = React.createClass({

    render: function () {
        
        var sequenceComponents = this.props.sequences.map(function (sequence, index) {
            return <SequenceItem key={index} sequence={sequence} index={index} />;
        });

        return (
            <ListGroup fill>
                {sequenceComponents}
            </ListGroup>
        );
    }

});

module.exports = Report;