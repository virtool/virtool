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

import React from "react";
import FlipMove from "react-flip-move"
import { capitalize, find } from 'lodash';
import { Row, Col } from "react-bootstrap";
import { Modal, Icon, ListGroupItem } from 'virtool/js/components/Base';

var Add = require('./Add');
var Permissions = require('./Permissions');


function getNewActiveId (currentActiveId, oldDocuments, newDocuments) {
    // In this case a new document has been added and should become the new activeId.
    if (newDocuments.length > oldDocuments.length) {
        // Find the new document id.
        return difference(map(newDocuments, '_id'), map(oldDocuments, '_id'))[0];
    }

    // Remove a user.
    if (newDocuments.length < oldDocuments.length) {
        // Find the index of the user document with the current activeId.
        var activeIndex = findIndex(oldDocuments, {_id: currentActiveId});

        if (activeIndex >= newDocuments.length) activeIndex -= 1;

        // If the removed first user is active, set the new first user as active. Otherwise make active the user
        // that occupies that position the old activeId did.
        return newDocuments[activeIndex]._id;
    }

    return currentActiveId;
}

/**
 * Renders either a table describing the sessions associated with the user or a panel with a message indicating no
 * sessions are associated with that user.
 *
 * @class
 */
var Groups = React.createClass({

    getInitialState: function () {
        var documents = this.getEntries();

        return {
            documents: documents,
            activeId: documents[0]._id
        };
    },

    componentDidMount: function () {
        dispatcher.db.groups.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.groups.off('change', this.update);
    },

    getEntries: function () {
        return dispatcher.db.groups.chain().find().simplesort('_id').data();
    },

    select: function (groupId) {
        this.setState({activeId: groupId});
    },

    update: function () {
        var newDocuments = this.getEntries();

        this.setState({
            documents: newDocuments,
            activeId: getNewActiveId(this.state.activeId, this.state.documents, newDocuments)
        });
    },

    remove: function (groupName) {
        dispatcher.db.groups.request('remove_group', {
            _id: groupName
        });
    },

    render: function () {

        var groupItemComponents = this.state.documents.map(function (document) {
            var props = {
                key: document._id,
                active: this.state.activeId == document._id,
                onClick: function () {this.select(document._id)}.bind(this)
            };

            var callback = function () {
                this.remove(document._id);
            }.bind(this);

            var removeIcon;

            if (document._id !== 'limited' && document._id !== 'administrator') {
                removeIcon = <Icon name='remove' className='pull-right' onClick={callback} />;
            }

            return (
                <ListGroupItem {...props}>
                    {_.capitalize(document._id)}
                    {removeIcon}
                </ListGroupItem>
            );

        }, this);

        var activeGroup = _.find(this.state.documents, {_id: this.state.activeId});

        return (
            <Modal dialogClassName='modal-md' show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    User Groups
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={6}>
                            <FlipMove>
                                <Add collection={dispatcher.db.groups} />
                                {groupItemComponents}
                            </FlipMove>
                        </Col>
                        <Col md={6}>
                            <FlipMove leaveAnimation={false} duration={200}>
                                <Permissions
                                    key={activeGroup._id}
                                    groupName={activeGroup._id}
                                    permissions={activeGroup.permissions}
                                    collection={dispatcher.db.groups}
                                />
                            </FlipMove>
                        </Col>
                    </Row>
                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = Groups;
