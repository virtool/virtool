/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisList
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var FlipMove = require('react-flip-move');

var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');


var AnalysisItem = require('./Item.jsx');

/**
 * A component that lists the analyses associated with a sample and contains a form to add new analyses.
 *
 * @class
 */
var AnalysisList = React.createClass({

    mixins: [LinkedStateMixin],

    propTypes: {
        canModify: React.PropTypes.bool
    },

    getInitialState: function () {
        return {
            name: '',
            algorithm: 'pathoscope_bowtie',

            // True when an analysis request has been sent to the server, but the transaction has not returned.
            pending: false
        }
    },

    /**
     * Handle submission of the new analysis form. Sends a request to the server.
     *
     * @param event {object} - the form submit event.
     * @func
     */
    handleSubmit: function (event) {
        event.preventDefault();
        this.setState({pending: true}, function () {
            dispatcher.db.samples.request('analyze', {
                samples: [this.props.detail._id],
                discovery: false,
                algorithm: this.state.algorithm,
                comments: this.state.nickname || null
            }).success(function () {
                this.setState(this.getInitialState());
            }, this);
        });
    },

    render: function () {

        var adder;

        if (this.props.canModify) {
            if (dispatcher.db.indexes.count({ready: true}) > 0) {
                
                var textProps = {
                    label: 'Name',
                    type: 'text',
                    style: {marginRight: '10px'},
                    valueLink: this.linkState('nickname'),
                    disabled: this.state.pending
                };

                adder = (
                    <form onSubmit={this.handleSubmit}>
                        <Flex>
                            <Flex.Item grow={1}>
                                <Input
                                    type="select"
                                    label="Algorithm"
                                    valueLink={this.linkState('algorithm')}
                                </Input>
                                    <Input {...textProps} />
                            </Flex.Item>
                            <Flex.Item>
                                    <FormGroup>
                                        <InputGroup disabled={this.state.pending}>
                                            <ControlLabel>Algorithm</ControlLabel>
                                            <FormControl type="select" valueLink={this.linkState('algorithm')} />
                                        </InputGroup>
                                    </FormGroup>
                            </Flex.Item>
                            <Flex.Item>
                                <div style={paddingTop}>
                                    <PushButton type='submit' bsStyle='primary'>
                                        <Icon name='new-entry' pending={this.state.pending}/> Create
                                    </PushButton>
                                </div>
                            </Flex.Item>
                        </Flex>
                    </form>
                );
            } else {
                adder = (
                    <Alert bsStyle='warning'>
                        <Icon name='info'/> A virus index must be built before analyses can be run.
                    </Alert>
                );
            }
        }

        // The content that will be shown below the 'New Analysis' form.
        var listContent;

        // Show a list of analyses if there are any.
        if (this.props.data.analyses.length > 0) {

            // Sort by timestamp so the newest analyses are at the top.
            var sorted = _.sortBy(this.props.data.analyses, 'timestamp').reverse();

            // The components that detail individual analyses.
            listContent = sorted.map(function (document) {
                return (
                    <AnalysisItem
                        key={document._id}
                        {...document}
                        {...this.props}
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