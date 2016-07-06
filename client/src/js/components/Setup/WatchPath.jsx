/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupWatchPath
 */

'use strict';

var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var Input = require('react-bootstrap/lib/Input');
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var SetupWatchPath = React.createClass({

    mixins: [LinkedStateMixin],

    getInitialState: function () {
        return {
            watchPath: this.props.watchPath || 'watch'
        };
    },

    componentDidMount: function () {
        this.refs.input.getInputDOMNode().focus();
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

                <Input ref='input' type='text' label='Path' valueLink={this.linkState('watchPath')} />

                <Button bsStyle='primary' className='pull-right' type='submit'>
                    <Icon name='floppy' /> Save
                </Button>
            </form>
        );
    }

});

module.exports = SetupWatchPath;
