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
var FlipMove = require('react-flip-move');
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
        var documents = dispatcher.db.users.chain().find().simplesort('_id');

        return {
            filter: "",
            documents: documents,
            activeId: documents.copy().data()[0]._id,
            addedId: null,
        };
    },

    componentDidMount: function () {
        dispatcher.db.users.on('change', this.update);
        dispatcher.db.groups.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.users.off('change', this.update);
        dispatcher.db.groups.off('change', this.update);
    },

    add: function (data, success, failure) {
        this.setState({
            addedId: data._id
        }, function () {
            dispatcher.db.users.request('add', data)
                .failure(failure)
                .success(function () {
                    success();
                }, this);
        });
    },

    /**
     * Called when the users collection changes. Updates the user documents and activeId appropriately.
     */
    update: function () {
        var newState = {
            documents: dispatcher.db.users.chain().find().simplesort('_id')
        };

        if (this.state.addedId) {
            // Check if the addedId is in the new set of documents. Set it as the activeId if it is in the new set.
            var addedCount = newState.documents.copy().find({$or: [
                {_id: {$regex: [this.state.filter, "i"]}},
                {_id: this.state.activeId}
            ]}, true).count();

            if (addedCount) {
                newState.activeId = this.state.addedId;
                newState.addedId = null;
            }
        }

        if (!newState.hasOwnProperty("activeId")) {
            // If we are not switching focus to a newly added user, check if we have to change the activeId due to the
            // removal of a user record.
            if (newState.documents.copy().find({_id: this.state.activeId}, true).count() === 0) {
                newState.activeId = newState.documents.copy().data()[0]._id;
            }
        }

        this.setState(newState);
    },

    /**
     * Update the text used to filter the list of users. Triggered by changing the value of the filter field.
     *
     * @param event {event} - the input change event.
     * @func
     */
    filter: function (event) {
        this.setState({filter: event.target.value});
    },

    /**
     * Changes the selected user based on _id. This method is called in the UserEntry component when it is clicked.
     */
    setActiveId: function (_id) {
        this.setState({activeId: _id});
    },

    /**
     * Remove the selected user (activeId). Called when the remove icon in the main panel header is clicked.
     *
     * @func
     */
    removeUser: function () {
        dispatcher.db.users.request('remove_user', {_id: this.state.activeId});
    },

    render: function () {

        var documents = this.state.documents.copy().find({
            $or: [
                {_id: {$regex: [this.state.filter, "i"]}},
                {_id: this.state.activeId}
            ]
        }).data();

        var activeData = _.find(documents, {_id: this.state.activeId});

        var userComponents = documents.map(function (user) {
            return (
                <UserEntry
                    key={user._id}
                    _id={user._id}
                    active={activeData._id === user._id}
                    onClick={this.setActiveId}
                />
            );
        }, this);
        
        // The content to display in the user panel. Can be user detail and edit fields or it can be the add user form.
        var content;

        var removeIcon;

        // Prevent administrators from removing their own accounts.
        if (dispatcher.user.name !== activeData._id) {
            removeIcon = (
                <div className='icon-group'>
                    <Icon onClick={this.removeUser} name='remove' pullRight />
                </div>
            );
        }

        // The header of the user detail panel. Contains a remove user icon button.
        var header = (
            <h3>
                <span>
                    <Icon name='user' /> {activeData._id}
                </span>
                {removeIcon}
            </h3>
        );

        content = (
            <Panel header={header} key={activeData._id}>
                <Password {...activeData} />
                <GroupsPermissions  {...activeData} />
                <PrimaryGroup {...activeData} />
                <Sessions {...activeData} />
            </Panel>
        );

        return (
            <Row>
                <Col sm={4}>
                    <Toolbar
                        onChange={this.filter}
                        add={this.add}
                    />
                    <FlipMove typeName="div" duration={200} className="list-group">
                        {userComponents}
                    </FlipMove>
                </Col>
                <Col sm={8}>
                    <FlipMove typeName="div" leaveAnimation={false} duration={200}>
                        {content}
                    </FlipMove>
                </Col>
            </Row>
        );
    }
});

module.exports = Users;