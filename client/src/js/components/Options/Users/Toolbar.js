/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserToolbar
 */

'use strict';

import React from "react";
import { FormGroup, InputGroup, FormControl, ButtonToolbar } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button } from 'virtool/js/components/Base';

var Add = require('./Add');
var Groups = require('./Groups/Groups');

/**
 * A toolbar used to filter the user list, add new users, and modify groups.
 *
 * @class
 */
var UserToolbar = React.createClass({

    propTypes: {
        onChange: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            showAddUser: false,
            showGroups: false
        }
    },

    showAddUserModal: function () {
        this.setState({
            showAddUser: true,
            showGroups: false
        });
    },

    showGroupsModal: function () {
        this.setState({
            showAddUser: false,
            showGroups: true
        });
    },

    hideModal: function () {
        this.setState({
            showAddUser: false,
            showGroups: false
        });
    },

    render: function () {

        return (
            <div>
                <Flex>
                    <FlexItem grow={1}>
                        <FormGroup>
                            <InputGroup>
                                <InputGroup.Addon>
                                    <Icon name='search' />
                                </InputGroup.Addon>
                                <FormControl
                                    type="text"
                                    onChange={this.props.onChange}
                                />
                            </InputGroup>
                        </FormGroup>
                    </FlexItem>

                    <FlexItem pad>
                        <Button bsStyle='primary' onClick={this.showGroupsModal}>
                            <Icon name='users' />
                        </Button>
                    </FlexItem>

                    <FlexItem pad>
                        <Button bsStyle='primary' onClick={this.showAddUserModal}>
                            <Icon name='plus-square' />
                        </Button>
                    </FlexItem>
                </Flex>

                <Add
                    show={this.state.showAddUser}
                    add={this.props.add}
                    onHide={this.hideModal}
                    collection={dispatcher.db.users}
                />

                <Groups
                    show={this.state.showGroups}
                    onHide={this.hideModal}
                />
            </div>
        );
    }
});

module.exports = UserToolbar;

