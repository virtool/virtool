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

var React = require('react');
var Input = require('react-bootstrap/lib/InputGroup');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Add = require('./Add.jsx');
var Groups = require('./Groups/Groups.jsx');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

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

        var addon = <Icon name='search' />;

        return (
            <div>
                <Flex>
                    <Flex.Item grow={1}>
                        <Input
                            type='text'
                            addonBefore={addon}
                            onChange={this.props.onChange}
                        />
                    </Flex.Item>

                    <Flex.Item pad>
                        <PushButton bsStyle='primary' onClick={this.showGroupsModal}>
                            <Icon name='users' />
                        </PushButton>
                    </Flex.Item>

                    <Flex.Item pad>
                        <PushButton bsStyle='primary' onClick={this.showAddUserModal}>
                            <Icon name='plus-square' />
                        </PushButton>
                    </Flex.Item>
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

