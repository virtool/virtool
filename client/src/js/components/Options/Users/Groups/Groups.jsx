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
var React = require('react');
var FlipMove = require('react-flip-move');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Utils = require('virtool/js/Utils');
var Add = require('./Add.jsx');
var Permissions = require('./Permissions.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

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
            activeId: Utils.getNewActiveId(this.state.activeId, this.state.documents, newDocuments)
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
