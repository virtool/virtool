/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostsTable
 */

'use strict';

var React = require('react');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var Panel = require('react-bootstrap/lib/Panel');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Entry = require('./Entry.jsx');

/**
 * A table describing all available and importing host references.
 *
 * @class
 */
var HostsTable = React.createClass({

    getInitialState: function () {
        return {
            documents: _.sortBy(dispatcher.db.hosts.find(), '_id'),
            detailTarget: null
        }
    },

    componentDidMount: function () {
        dispatcher.db.hosts.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.hosts.off('change', this.update);
    },

    /**
     * Show the details for the document described by the passed target object. Called when the modal is shown by clicking
     * a host document.
     *
     * @param target {object} - an object (partial document) describing the document to fetch detail for.
     * @func
     */
    showModal: function (target) {
        dispatcher.router.setExtra(["detail", target._id]);
    },

    /**
     * Update state to reflect changes in host collection documents. Triggered by an update event in the collection.
     *
     * @func
     */
    update: function () {
        this.setState({documents: _.sortBy(dispatcher.db.hosts.find(), '_id')});
    },

    render: function () {
        // The component to show in the table area. Will be either a table or a panel saying that there are no hosts.\
        var listContent;

        if (this.state.documents.length > 0) {
            listContent = this.state.documents.map(function (document) {
                return (
                    <Entry
                        {...document}
                        key={document._id}
                        showModal={this.showModal}
                    />
                )
            }, this);
        } else {
            listContent = (
                <ListGroupItem className='text-center'>
                    <Icon name='notification' /> No hosts added.
                </ListGroupItem>
            );
        }

        return (
            <div>
                <Panel header='Hosts'>
                    <ListGroup fill>
                        {listContent}
                    </ListGroup>
                </Panel>
            </div>
        )
    }
});

module.exports = HostsTable;