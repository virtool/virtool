/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Users
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/Input');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Utils = require('virtool/js/Utils');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Toolbar = require('./Users/Toolbar.jsx');
var Password = require('./Users/Password.jsx');
var Add = require('./Users/Add.jsx');
var UserEntry = require('./Users/Entry.jsx');
var Sessions = require('./Users/Sessions.jsx');
var PrimaryGroup = require('./Users/PrimaryGroup.jsx');
var GroupsPermissions = require('./Users/GroupsPermissions.jsx');

/**
 * A component for managing users that is accessible in the options section. Contains components for changing passwords,
 * forcing password resets, changing user roles, and removing and adding users. All of the sessions registered to each
 * user are also shown.
 *
 * @class
 */
var Users = React.createClass({

    getInitialState: function () {
        var documents = _.sortBy(dispatcher.collections.users.documents, '_id');

        return {
            documents: documents,

            // The id of the user whose panel is currently open.
            activeId: documents[0]._id
        };
    },

    componentDidMount: function () {
        dispatcher.collections.users.on('change', this.update);
        dispatcher.collections.groups.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.collections.users.off('change', this.update);
        dispatcher.collections.groups.off('change', this.update);
    },

    /**
     * Called when the users collection changes. Updates the user documents and activeId appropriately.
     */
    update: function () {
        // Get the updated documents
        var newDocuments = _.sortBy(dispatcher.collections.users.documents, '_id');
        var activeId = Utils.getNewActiveId(this.state.activeId, this.state.documents, newDocuments);

        console.log(activeId);

        this.setState({
            documents: newDocuments,
            activeId: activeId
        });
    },

    /**
     * Update the text used to filter the list of users. Triggered by changing the value of the filter field.
     *
     * @param event {event} - the input change event.
     * @func
     */
    onFilter: function (event) {
        var documents = dispatcher.collections.users.documents;

        if (event && event.target.value) {
            var regEx = new RegExp('^' + event.target.value, 'i');

            documents = _.filter(documents, function (document) {
                return regEx.test(document._id);
            });
        }

        this.setState({documents: _.sortBy(documents, '_id')});
    },

    /**
     * Changes the selected user based on _id. This method is called in the UserEntry commponent when it is clicked.
     */
    selectUser: function (_id) {
        this.setState({activeId: _id});
    },

    /**
     * Remove the selected user (activeId). Called when the remove icon in the main panel header is clicked.
     *
     * @func
     */
    removeUser: function () {
        dispatcher.collections.users.request('remove_user', {_id: this.state.activeId});
    },

    render: function () {

        var userComponents = this.state.documents.map(function (user) {
            return (
                <UserEntry
                    {...user}
                    key={user._id}
                    activeId={this.state.activeId}
                    disabled={this.state.adding}
                    handleSelect={this.selectUser}
                />
            );
        }, this);
        
        // The content to display in the user panel. Can be user detail and edit fields or it can be the add user form.
        var content;

        var activeData = _.find(this.state.documents, {_id: this.state.activeId});
        
        // The header of the user detail panel. Contains a remove user icon button.
        var header = (
            <h3>
                <span>
                    <Icon name='user' /> {activeData._id}
                </span>
                <div className='icon-group'>
                    <Icon onClick={this.removeUser} name='remove' pullRight />
                </div>
            </h3>
        );

        content = (
            <Panel header={header}>
                <Password {...activeData} />
                <GroupsPermissions  {...activeData} />
                <PrimaryGroup {...activeData} />
                <Sessions {...activeData} />
            </Panel>
        );

        return (
            <Row>
                <Col sm={4}>
                    <Toolbar onChange={this.onFilter} />
                    <Panel>
                        <ListGroup fill>
                            {userComponents}
                        </ListGroup>
                    </Panel>
                </Col>
                <Col sm={8}>
                    {content}
                </Col>
            </Row>
        );
    }
});

module.exports = Users;