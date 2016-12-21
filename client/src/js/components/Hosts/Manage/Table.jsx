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

import React from "react";
import { pick, sortBy } from "lodash";
import { Panel, ListGroup, ListGroupItem } from "react-bootstrap";
import Icon from 'virtool/js/components/Base/Icon.jsx';
import Entry from './Entry.jsx';

/**
 * A table describing all available and importing host references.
 *
 * @class
 */
var HostsTable = React.createClass({

    getInitialState: function () {
        return {
            documents: sortBy(dispatcher.db.hosts.find(), '_id'),
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
        this.setState({documents: sortBy(dispatcher.db.hosts.find(), '_id')});
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