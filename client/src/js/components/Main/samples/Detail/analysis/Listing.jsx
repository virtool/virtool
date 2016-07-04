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
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Input = require('react-bootstrap/lib/Input');
var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
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
            this.props.collection.request('analyze', {
                samples: [this.props.detail._id],
                discovery: false,
                algorithm: this.state.algorithm,
                comments: this.state.nickname || null
            }, this.onSuccess);
        });
    },

    /**
     * Clears the New Analysis form and removes pending state. Called when the new analysis transaction completes.
     *
     * @func
     */
    onSuccess: function () {
        this.setState(this.getInitialState());
    },

    render: function () {

        var adder;

        if (this.props.canModify) {
            if (_.some(dispatcher.collections.indexes.documents, {ready: true})) {
                
                var textProps = {
                    label: 'Name',
                    type: 'text',
                    style: {marginRight: '10px'},
                    valueLink: this.linkState('nickname'),
                    disabled: this.state.pending
                };

                var selectProps = {
                    label: 'Algorithm',
                    type: 'select',
                    style: {marginRight: '10px'},
                    valueLink: this.linkState('algorithm'),
                    disabled: this.state.pending
                };

                var paddingRight = {
                    paddingRight: '5px'
                };

                var paddingTop = {
                    marginTop: '25px'
                };

                adder = (
                    <form onSubmit={this.handleSubmit}>
                        <Flex>
                            <Flex.Item grow={1}>
                                <div style={paddingRight}>
                                    <Input {...textProps} />
                                </div>
                            </Flex.Item>
                            <Flex.Item grow={0.25}>
                                <div style={paddingRight}>
                                    <Input {...selectProps}>
                                        <option value='pathoscope_bowtie'>PathoscopeBowtie</option>
                                        <option value='pathoscope_snap'>PathoscopeSNAP</option>
                                        <option value='nuvs'>NuVs</option>
                                        <option value='sigma' disabled>Sigma</option>
                                    </Input>
                                </div>
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
                <ListGroup componentClass='div'>
                    {listContent}
                </ListGroup>
            </div>
        );
    }
});

module.exports = AnalysisList;