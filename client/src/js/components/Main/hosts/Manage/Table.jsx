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

var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var HostDetail = require('./Detail.jsx');
var Entry = require('./Entry.jsx');

/**
 * A table describing all available and importing host references.
 *
 * @class
 */
var HostsTable = React.createClass({

    getInitialState: function () {
        return {
            documents: _.sortBy(this.props.collection.documents, '_id'),
            detailTarget: null
        }
    },

    componentDidMount: function () {
        this.props.collection.on('change', this.update);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return nextState !== this.state;
    },

    componentWillUnmount: function () {
        this.props.collection.off('change', this.update);
    },

    /**
     * Show the details for the document described by the passed target object. Called when the modal is shown by clicking
     * a host document.
     *
     * @param target {object} - an object (partial document) describing the document to fetch detail for.
     * @func
     */
    showModal: function (target) {
        this.setState({detailTarget: target});
    },

    /**
     * Hide the detail modal. Passed to Modal components as the onHide prop. Called when the modal is hiding.
     *
     * @func
     */
    hideModal: function () {
        this.setState({detailTarget: null});
    },

    /**
     * Update state to reflect changes in host collection documents. Triggered by an update event in the collection.
     *
     * @func
     */
    update: function () {
        this.setState({documents: _.sortBy(this.props.collection.documents, '_id')});
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
                        collection={this.props.collection}
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

                <DetailModal
                    target={this.state.detailTarget}
                    contentComponent={HostDetail}
                    collection={this.props.collection}
                    onHide={this.hideModal}
                    dialogClassName='modal-md'
                />
            </div>
        )
    }
});

module.exports = HostsTable;