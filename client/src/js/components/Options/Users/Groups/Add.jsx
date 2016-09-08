/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddGroup
 */

'use strict';

var _ = require('lodash');
var React = require('react');

var Input = require('virtool/js/components/Base/InputError.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var AddGroup = React.createClass({

    getInitialState: function () {
        return {
            groupName: '',
            error: false
        };
    },

    handleSubmit: function (event) {
        event.preventDefault();

        // Make sure the new group name has no spaces in it.
        if (this.state.groupName.length > 0 && this.state.groupName.indexOf(' ') === -1) {
            dispatcher.db.groups.request('add', {
                _id: this.state.groupName.toLowerCase()
            });
        } else {
            this.setState({
                error: true
            });
        }

        this.setState(this.getInitialState());
    },

    handleChange: function (event) {
        this.setState({
            groupName: event.target.value,
            error: false
        });
    },

    render: function () {

        var addonAfter = (
            <PushButton type='submit' bsStyle='primary'>
                <Icon name='plus-square' /> Add
            </PushButton>
        );

        return (
            <form onSubmit={this.handleSubmit}>
                <Input
                    type="text"
                    error={this.state.error ? 'Group names must not contain spaces and cannot be empty strings.': null}
                    buttonAfter={addonAfter}
                    placeholder='Group name'
                    value={this.state.groupName}
                    onChange={this.handleChange}
                />
            </form>
        );
    }
});

module.exports = AddGroup;
