'use strict';

var _ = require('lodash');
var React = require('react');
var FlipMove = require('react-flip-move');

var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var AnalysisAdder = require('./Adder.jsx');
var AnalysisItem = require('./Item.jsx');

var AnalysisList = React.createClass({

    propTypes: {
        canModify: React.PropTypes.bool
    },

    render: function () {

        var adder;

        if (this.props.canModify) {
            if (dispatcher.db.indexes.count({ready: true}) === 0) {
                adder = (
                    <Alert bsStyle='warning'>
                        <Icon name='info'/> A virus index must be built before analyses can be run.
                    </Alert>
                );

            } else {
                adder = (
                    <AnalysisAdder
                        sampleId={this.props._id}
                        setProgress={this.props.setProgress}
                    />
                );
            }
        }

        // The content that will be shown below the 'New Analysis' form.
        var listContent;

        // Show a list of analyses if there are any.
        if (this.props.analyses) {

            // Sort by timestamp so the newest analyses are at the top.
            var sorted = _.sortBy(this.props.analyses, 'timestamp').reverse();

            // The components that detail individual analyses.
            listContent = sorted.map(function (document) {
                return (
                    <AnalysisItem
                        key={document._id}
                        {...document}
                        canModify={this.props.canModify}
                        setProgress={this.props.setProgress}
                        selectAnalysis={this.props.selectAnalysis}
                    />
                );
            }, this);
        }

        // If no analyses are associated with the sample, show a panel saying so.
        else {
            listContent = (
                <ListGroupItem className='text-center'>
                    <Icon name='info' /> No analyses found
                </ListGroupItem>
            );
        }

        return (
            <div>
                {adder}
                <FlipMove typeName="ul" className="list-group">
                    {listContent}
                </FlipMove>
            </div>
        );
    }
});

module.exports = AnalysisList;