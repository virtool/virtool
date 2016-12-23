/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports GroupsPermissions
 */

'use strict';

import React from "react";
import { capitalize, includes} from 'lodash';
import { Row, Col, Panel, ListGroup } from "react-bootstrap";
import { ListGroupItem, Checkbox, Icon, Help } from "virtool/js/components/Base";

var Permissions = require('./Groups/Permissions');

var GroupToggle = React.createClass({

    propTypes: {
        userId: React.PropTypes.string.isRequired,
        groupId: React.PropTypes.string.isRequired,
        toggled: React.PropTypes.bool.isRequired
    },

    getInitialState: function () {
        return {
            pending: false
        };
    },

    componentWillReceiveProps: function (nextProps) {
        if (this.props.toggled !== nextProps.toggled) {
            this.setState({pending: false});
        }
    },

    handleClick: function () {
        if (!(this.props.userId === dispatcher.user.name && this.props.groupId === 'administrator')) {
            this.setState({pending: true}, function () {
                this.props.setGroup(this.props.userId, this.props.groupId);
            });
        }
    },

    render: function () {
        var disabled = this.props.userId === dispatcher.user.name && this.props.groupId === 'administrator';
        
        return (
            <ListGroupItem key={this.props.groupId} onClick={this.handleClick} disabled={disabled}>
                {_.capitalize(this.props.groupId)}
                <Checkbox checked={this.props.toggled} pending={this.state.pending} pullRight />
            </ListGroupItem>
        );
    }

});

var GroupsPermissions = React.createClass({

    propTypes: {
        groups: React.PropTypes.array.isRequired,
        permissions: React.PropTypes.object.isRequired
    },

    setGroup: function (userId, groupId) {
        dispatcher.db.users.request('set_group', {
            user_id: userId,
            group_id: groupId
        });
    },

    render: function () {

        var groupComponents = dispatcher.db.groups.find().map(function (group, index) {
            return (
                <GroupToggle
                    key={index}
                    userId={this.props._id}
                    groupId={group._id}
                    toggled={_.includes(this.props.groups, group._id)}
                    setGroup={this.setGroup}
                />
            );
        }, this);

        return (
            <div>
                <Row>
                    <Col md={5}>
                        <h5><Icon name='users' /> <strong>Groups</strong></h5>
                    </Col>
                    <Col md={7}>
                        <h5>
                            <span>
                                <Icon name='key' /> <strong>Permissions</strong>
                            </span>
                            <Help pullRight>
                                Users inherit permissions from groups they belong to. Change a user's groups to modify their
                                permissions.
                            </Help>
                        </h5>
                    </Col>
                </Row>
                <Row>
                    <Col md={5}>
                        <Panel style={{height: '493px', overflowY: 'scroll'}}>
                            <ListGroup fill style={{borderBottom: '1px solid #dddddd'}}>
                                {groupComponents}
                            </ListGroup>
                        </Panel>
                    </Col>
                    <Col md={7} style={{height: '100%'}}>
                        <Permissions permissions={this.props.permissions} />
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = GroupsPermissions;