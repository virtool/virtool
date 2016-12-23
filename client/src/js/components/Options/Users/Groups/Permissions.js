/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Groups
 */

'use strict';

var _ = require('lodash');
import React from "react";
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Permission = require('./Permission');

var Permissions = React.createClass({

    propTypes: {
        collection: React.PropTypes.object,
        permissions: React.PropTypes.object,
        groupName: React.PropTypes.string
    },

    render: function () {

        var content;

        if (this.props.permissions) {

            var permissions = _.transform(this.props.permissions, function (result, value, name) {
                result.push({
                    name: name,
                    value: value
                });
            }, []);

            var disabled = this.props.groupName === 'administrator' || this.props.groupName === 'limited';

            var permissionComponents = _.sortBy(permissions, 'name').map(function (permission) {
                return (
                    <Permission
                        key={permission.name}
                        {...permission}
                        groupName={this.props.groupName}
                        disabled={disabled}
                        collection={this.props.collection}
                    />
                );
            }, this);

            content = (
                <ListGroup fill={this.props.groupName && this.props.collection}>
                    {permissionComponents}
                </ListGroup>
            );
        } else {
            content = <Panel>Nothing to see here</Panel>;
        }

        if (this.props.groupName && this.props.collection) {
            return (
                <Panel header='Permissions'>
                    {content}
                </Panel>
            );
        }

        return content;
    }
});

module.exports = Permissions;
