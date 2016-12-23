/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SampleSelector
 *
 */

'use strict';

import React from "react";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import { Icon, Flex, Checkbox, Button } from "virtool/js/components/Base";

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
var SampleSelector = React.createClass({

    propTypes: {
        selected: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
    },

    getInitialState: function () {
        return {
            pending: false,
            algorithm: dispatcher.user.settings.quick_analyze_algorithm
        };
    },

    setAlgorithm: function (event) {
        this.setState({
            algorithm: event.target.value
        });
    },

    archive: function () {
        var candidates = _.filter(this.props.selected, function (document) {
            return !this.props.archived && document.analyzed === true;
        }.bind(this));

        dispatcher.db.samples.request('archive', {_id: _.map(candidates, "_id")});
    },

    handleSubmit: function (event) {
        event.preventDefault();

        this.setState({pending: true}, function () {
            dispatcher.db.samples.request('analyze', {
                samples: _.map(this.props.selected, "_id"),
                algorithm: this.state.algorithm,
                name: null
            }).success(function () {
                this.setState({
                    pending: false
                });
            }, this).failure(function () {
                this.setState({
                    pending: false
                });
            }, this);
        });
    },

    render: function () {

        var selectedCount = this.props.selected.length;

        var flexStyle = {
            marginBottom: "15px"
        };

        var archiveButton;

        if (!this.props.archived && _.some(this.props.selected, {analyzed: true})) {
            archiveButton = (
                <Flex.Item pad={5}>
                    <Button tip="Archive Samples" bsStyle='info' onClick={this.archive}>
                        <Icon name='box-add' />
                    </Button>
                </Flex.Item>
            );
        }

        return (
            <div>
                <Flex style={flexStyle} alignItems="stretch">
                    <Flex.Item shrink={0}>
                        <Button onClick={this.props.selectNone} style={{padding: "6px 15px"}}>
                            Selected {selectedCount}
                        </Button>
                    </Flex.Item>

                    <Flex.Item grow={1} pad={5}>
                        <form onSubmit={this.handleSubmit}>
                            <FormGroup bsClass="form-group no-margin">
                                <InputGroup>
                                    <InputGroup.Addon>
                                        Analyze
                                    </InputGroup.Addon>
                                    <FormControl componentClass="select" value={this.state.algorithm} onChange={this.setAlgorithm}>
                                        <option value="pathoscope_bowtie">PathoscopeBowtie</option>
                                        <option value="pathoscope_snap">PathoscopeSNAP</option>
                                        <option value="nuvs">NuVs</option>
                                    </FormControl>
                                    <InputGroup.Button>
                                        <Button type='submit' tip="Start Quick Analysis" bsStyle='success'>
                                            <Icon name='bars' />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </FormGroup>
                        </form>
                    </Flex.Item>

                    {archiveButton}
                </Flex>
            </div>
        );
    }
});

module.exports = SampleSelector;