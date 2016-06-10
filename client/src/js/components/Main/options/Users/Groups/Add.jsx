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

var Input = require('react-bootstrap/lib/Input');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var AddGroup = React.createClass({

    propTypes: {
        collection: React.PropTypes.object.isRequired
    },

    getInitialState: function () {
        return {
            groupName: ''
        };
    },

    handleSubmit: function (event) {
        event.preventDefault();

        // Make sure the new group name has no spaces in it.
        if (this.state.groupName.indexOf(' ') === -1) {
            dispatcher.collections.groups.request('add', {
                _id: this.state.groupName.toLowerCase()
            });
        }

        this.setState(this.getInitialState());
    },

    handleChange: function (event) {
        this.setState({
            groupName: event.target.value
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
