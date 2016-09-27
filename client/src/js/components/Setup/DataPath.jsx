/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupDataPath
 *
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var Utils = require('virtool/js/Utils');

var SetupDataPath = React.createClass({

    getInitialState: function () {
        return {
            dataPath: this.props.dataPath || 'data',
            feedback: null
        };
    },

    componentDidMount: function () {
        this.refs.input.focus();
    },

    handleChange: function () {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    },

    handleSubmit: function (event) {
        event.preventDefault();

        var args = {
            operation: 'set_data_path',
            host: this.props.host,
            port: this.props.port,
            name: this.props.name,
            path: this.state.dataPath,
            new_server: !_.includes(this.props.names, this.props.name)
        };

        this.setState({pending: true, feedback: false}, function () {
            Utils.postJSON('/', args, this.onComplete);
        });
    },

    onComplete: function (data) {
        this.setState({pending: false}, function () {
            if (data.failed) {
                this.setState({
                    feedback: data
                });
            } else {
                this.props.updateSetup({
                    dataPath: this.state.dataPath
                }, this.props.nextStep);
            }
        });
    },

    dismissError: function () {
        this.setState({errors: null});
    },

    render: function () {
        var warning;

        if (this.props.hasCollections) {
            warning = (
                <Alert bsStyle='danger'>
                    <span>
                        The chosen database already exists and contains Virtool data collections. These collections
                        require matching files in the filesystem data path to work properly. Virtool will attempt to
                        make sure that the selected database and data path are compatible.
                    </span>
                </Alert>
            );
        }

        var error;

        if (this.state.feedback) {
            error = (
                <Alert bsStyle='danger' onDismiss={this.dismissError}>
                    {this.state.feedback.message}
                </Alert>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <Alert bsStyle='info'>
                    Virtool will use this path to store and read data including sample reads, viral and host references,
                    and logs. The path is relative to Virtool's working directory unless prepended with <strong>/</strong>.
                </Alert>

                {warning}

                <Input
                    ref="input"
                    type="text"
                    name="dataPath"
                    label="Path"
                    onChange={this.handleChange}
                    value={this.state.dataPath}
                />

                {error}

                <Button bsStyle='primary' className='pull-right' type='submit'>
                    <Icon name='floppy' /> Save
                </Button>
            </form>
        );
    }

});

module.exports = SetupDataPath;
