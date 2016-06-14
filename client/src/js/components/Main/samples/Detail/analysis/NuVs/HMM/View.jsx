var React = require('react');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var HMMItem = require('./Item.jsx');

var Report = React.createClass({

    render: function () {

        var hmmComponents = this.props.hmms.map(function (hmm, index) {
            return <HMMItem key={index} {...hmm} />;
        });

        return (
            <ListGroup fill>
                {hmmComponents}
            </ListGroup>
        );
    }

});

module.exports = Report;