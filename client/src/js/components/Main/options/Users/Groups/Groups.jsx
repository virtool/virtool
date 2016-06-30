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
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');

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
        return {
            documents: this.getEntries(),
            activeGroupIndex: 0
        };
    },

    select: function (newActiveGroupIndex) {
        this.setState({activeGroupIndex: newActiveGroupIndex});
    },

    getEntries: function () {
        return _.sortBy(dispatcher.collections.groups.documents, '_id');
    },

    componentDidMount: function () {
        dispatcher.collections.groups.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.collections.groups.off('change', this.update);
    },

    update: function () {
        this.setState({documents: this.getEntries()});
    },

    remove: function (groupName) {
        dispatcher.collections.groups.request('remove_group', {
            _id: groupName
        });
    },

    render: function () {

        var groupItemComponents = this.state.documents.map(function (document, index) {
            var props = {
                key: document._id,
                className: this.state.activeGroupIndex == index ? 'band': null,
                onClick: function () {this.select(index)}.bind(this)
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

        var activeGroup = this.state.documents[this.state.activeGroupIndex];

        return (
            <Modal dialogClassName='modal-md' show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header>
                    User Groups
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={6}>
                            <Add collection={dispatcher.collections.groups} />
                            {groupItemComponents}
                        </Col>
                        <Col md={6}>
                            <Permissions
                                groupName={activeGroup._id}
                                permissions={activeGroup.permissions}
                                collection={dispatcher.collections.groups}
                            />
                        </Col>
                    </Row>
                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = Groups;
