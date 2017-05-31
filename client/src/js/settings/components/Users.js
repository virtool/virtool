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

import React from "react";
import FlipMove from "react-flip-move"
import { find } from "lodash";
import { Row, Col, Panel } from "react-bootstrap";
import { Icon, getFlipMoveProps } from "virtool/js/components/Base";

import Toolbar from "./Users/Toolbar";
import Password from "./Users/Password";
import UserEntry from "./Users/Entry";
import Sessions from "./Users/Sessions";
import PrimaryGroup from "./Users/PrimaryGroup";
import GroupsPermissions from "./Users/GroupsPermissions";

/**
 * A component for managing users that is accessible in the options section. Contains components for changing passwords,
 * forcing password resets, changing user roles, and removing and adding users. All of the sessions registered to each
 * user are also shown.
 *
 * @class
 */
export default class ManageUsers extends React.Component {

    constructor (props) {
        super(props);

        const documents = getUsers();

        this.state = {
            filter: "",
            documents: documents,
            activeId: documents.copy().data()[0]._id,
            addedId: null,
        };
    }

    add = (data, success, failure) => {
        this.setState({addedId: data._id}, () => {
            dispatcher.db.users.request("add", data)
                .failure(() => failure())
                .success(() => success());
        });
    };

    /**
     * Called when the users collection changes. Updates the user documents and activeId appropriately.
     */
    update = () => {
        let newState = {
            documents: getUsers()
        };

        if (this.state.addedId) {
            // Check if the addedId is in the new set of documents. Set it as the activeId if it is in the new set.
            const addedCount = newState.documents.copy().find({$or: [
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
    };

    /**
     * Update the text used to filter the list of users. Triggered by changing the value of the filter field.
     *
     * @param event {event} - the input change event.
     * @func
     */
    filter = (event) => {
        this.setState({filter: event.target.value});
    };

    /**
     * Changes the selected user based on _id. This method is called in the UserEntry component when it is clicked.
     */
    setActiveId = (_id) => {
        this.setState({activeId: _id});
    };

    /**
     * Remove the selected user (activeId). Called when the remove icon in the main panel header is clicked.
     *
     * @func
     */
    removeUser = () => {
        dispatcher.db.users.request("remove_user", {_id: this.state.activeId});
    };

    render () {

        const documents = this.state.documents.copy().find({
            $or: [
                {_id: {$regex: [this.state.filter, "i"]}},
                {_id: this.state.activeId}
            ]
        }).data();

        const activeData = find(documents, {_id: this.state.activeId});

        const userComponents = documents.map((user) =>
            <div key={user._id}>
                <UserEntry
                    _id={user._id}
                    active={activeData._id === user._id}
                    onClick={this.setActiveId}
                />
            </div>
        );

        let content;
        let removeIcon;

        // Prevent administrators from removing their own accounts.
        if (dispatcher.user.name !== activeData._id) {
            removeIcon = (
                <div className="icon-group">
                    <Icon onClick={this.removeUser} name="remove" pullRight />
                </div>
            );
        }

        // The header of the user detail panel. Contains a remove user icon button.
        const header = (
            <h3>
                <span>
                    <Icon name="user" /> {activeData._id}
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
                    <FlipMove {...getFlipMoveProps()}>
                        {userComponents}
                    </FlipMove>
                </Col>
                <Col sm={8}>
                    <FlipMove typeName="div" enterAnimation="fade" leaveAnimation={false} duration={180}>
                        {content}
                    </FlipMove>
                </Col>
            </Row>
        );
    }
}
