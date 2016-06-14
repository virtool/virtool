var React = require('react');
var Numeral = require('numeral');
var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var Label = require('react-bootstrap/lib/Label');
var Button = require('react-bootstrap/lib/Button');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var Report = React.createClass({

    render: function () {
        console.log(this.props);

        return (
            <div>
                <PushButton onClick={this.props.onBack}>
                    Back
                </PushButton>
                <p>{JSON.stringify(this.props.hmm)}</p>
                <ListGroup>


                </ListGroup>
            </div>
        );
    }

});

module.exports = Report;