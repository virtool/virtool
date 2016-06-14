var _ = require('lodash');
var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var Label = require('react-bootstrap/lib/Label');
var Button = require('react-bootstrap/lib/Button');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var HMMItem = require('./HMMItem.jsx');

var Report = React.createClass({

    render: function () {
        var hmmComponents = _.sortBy(this.props.hmm, 'full_e').map(function (hmm, index) {
            return <HMMItem key={index} {...hmm} />;
        });

        return (
            <div>
                <PushButton onClick={this.props.onBack}>
                    Back
                </PushButton>
                <ListGroup>
                    {hmmComponents}
                </ListGroup>
            </div>
        );
    }

});

module.exports = Report;