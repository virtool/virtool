/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostFiles
 */

'use strict';

var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');


var Fasta = require('./Fasta.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var HostFiles = React.createClass({

    getInitialState: function () {
        return {documents: dispatcher.db.files.find()};
    },

    componentDidMount: function () {
        // Listen for updates to the host files collection. Also tell the server to listen for changes in the files
        // directory and update the collection with any changes.
        dispatcher.db.files.on('change', this.update);
        dispatcher.listen('files');
    },

    componentWillUnmount: function () {
        // Stop listening for changes to the collection and tell the server that we don't want to watch for changes to
        // the host files anymore.
        dispatcher.db.files.off('change', this.update);
        dispatcher.unlisten('files');
    },

    /**
     * Update the host file documents based on the files collection.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {
        
        // The files documents.
        var listComponents = this.state.documents.map(function (file) {
            return (
                <Fasta
                    key={file._id}
                    add={this.add}
                    {...file}
                />
            )
        }, this);

        if (listComponents.length === 0) {
            listComponents = (
                <ListGroupItem className='text-center'>
                    <Icon name='notification' /> No files found.
                </ListGroupItem>
            );
        }

        return (
            <div>
                <Panel header='Available Files'>
                    <ListGroup fill>
                        {listComponents}
                    </ListGroup>
                </Panel>
            </div>
        )
    }
});

module.exports = HostFiles;