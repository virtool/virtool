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

var React = require('react');
var Well = require('react-bootstrap/lib/Well');
var Badge = require('react-bootstrap/lib/Badge');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

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
                    <PushButton tip="Archive Samples" bsStyle='info' onClick={this.archive}>
                        <Icon name='box-add' />
                    </PushButton>
                </Flex.Item>
            );
        }

        return (
            <div>
                <Flex style={flexStyle} alignItems="stretch">
                    <Flex.Item shrink={0}>
                        <PushButton onClick={this.props.selectNone} style={{padding: "6px 15px"}}>
                            Selected {selectedCount}
                        </PushButton>
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
                                        <PushButton type='submit' tip="Start Quick Analysis" bsStyle='success'>
                                            <Icon name='bars' />
                                        </PushButton>
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