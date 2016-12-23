/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Permission
 */

'use strict';

import React from "react";
import { startCase } from "lodash";
import { Checkbox, ListGroupItem } from "virtool/js/components/Base";

var Permission = React.createClass({

    propTypes: {
        name: React.PropTypes.string.isRequired,
        value: React.PropTypes.bool.isRequired,
        collection: React.PropTypes.object,
        disabled: React.PropTypes.bool
    },

    componentWillReceiveProps: function (nextProps) {
        if (this.props.value !== nextProps.value && this.state.pending) this.setState({pending: false});
    },

    getInitialState: function () {
        return {
            pending: false
        };
    },

    handleClick: function () {
        var permissionUpdate = {};

        permissionUpdate[this.props.name] = !this.props.value;

        this.setState({pending: true}, function () {
            dispatcher.db.groups.request('update_permissions', {
                _id: this.props.groupName,
                permissions: permissionUpdate
            });
        });
    },

    render: function () {

        var handleClick = this.props.collection && this.props.groupName ? this.handleClick: null;

        return (
            <ListGroupItem onClick={handleClick} disabled={this.props.disabled}>
                {_.startCase(this.props.name)}
                <span className='pull-right'>
                    <Checkbox checked={this.props.value} />
                </span>
            </ListGroupItem>
        );
    }
});

module.exports = Permission;
