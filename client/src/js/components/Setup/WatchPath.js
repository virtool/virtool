/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupWatchPath
 *
 */

'use strict';

import React from "react";
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon');
var Input = require('virtool/js/components/Base/Input');

var SetupWatchPath = React.createClass({

    getInitialState: function () {
        return {
            watchPath: this.props.watchPath || 'watch'
        };
    },

    componentDidMount: function () {
        this.refs.input.focus();
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    },

    handleSubmit: function (event) {
        event.preventDefault();

        this.props.updateSetup({
            watchPath: this.state.watchPath
        }, this.props.nextStep);
    },

    render: function () {
        return (
            <form onSubmit={this.handleSubmit}>
                <Alert bsStyle='info'>
                    Sequence files in this path will be visible and importable in Virtool.
                </Alert>

                <Input
                    ref='input'
                    type='text'
                    name="watchPath"
                    label='Path'
                    onChange={this.handleChange}
                    value={this.state.watchPath}
                />

                <Button bsStyle='primary' className='pull-right' type='submit'>
                    <Icon name='floppy' /> Save
                </Button>
            </form>
        );
    }

});

module.exports = SetupWatchPath;
