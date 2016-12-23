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


import React from "react";
import FlipMove from "react-flip-move"
import { sortBy } from 'lodash';
import { Alert } from "react-bootstrap";

import { ListGroupItem, Flex, Icon, Input, Button } from "virtool/js/components/Base";

var AnalysisItem = require('./Item');

/**
 * A component that lists the analyses associated with a sample and contains a form to add new analyses.
 *
 * @class
 */
var AnalysisList = React.createClass({

    propTypes: {
        sampleId: React.PropTypes.string.isRequired,
        analyses: React.PropTypes.arrayOf(React.PropTypes.object),
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

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    },

    /**
     * Handle submission of the new analysis form. Sends a request to the server.
     *
     * @param event {object} - the form submit event.
     * @func
     */
    handleSubmit: function (event) {
        event.preventDefault();

        this.props.setProgress(true);

        this.setState({pending: true}, function () {
            dispatcher.db.samples.request('analyze', {
                samples: [this.props.sampleId],
                discovery: false,
                algorithm: this.state.algorithm,
                name: this.state.name || null
            })
            .success(function () {
                this.props.setProgress(false);
                this.setState(this.getInitialState());
            }, this)
            .failure(function () {
                this.props.setProgress(false);
                this.setState(this.getInitialState());
            }, this)
        });
    },

    render: function () {

        var adder;

        if (this.props.canModify) {

            var buttonStyle = {
                marginBottom: "15px"
            };

            if (dispatcher.db.indexes.count({ready: true}) > 0) {
                adder = (
                    <form onSubmit={this.handleSubmit}>
                        <Flex alignItems="flex-end">
                            <Flex.Item grow={5}>
                                <Input
                                    name="name"
                                    label="Name"
                                    value={this.state.name}
                                    onChange={this.handleChange}
                                    disabled={true}
                                />
                            </Flex.Item>
                            <Flex.Item grow={1} pad>
                                <Input name="algorithm" type="select" label="Algorithm" value={this.state.algorithm} onChange={this.handleChange}>
                                    <option value='pathoscope_bowtie'>PathoscopeBowtie</option>
                                    <option value='pathoscope_snap'>PathoscopeSNAP</option>
                                    <option value='nuvs'>NuVs</option>
                                </Input>
                            </Flex.Item>
                            <Flex.Item pad>
                                <Button type='submit' style={buttonStyle} bsStyle='primary' disabled={this.state.pending}>
                                    <Icon name='new-entry' /> Create
                                </Button>
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