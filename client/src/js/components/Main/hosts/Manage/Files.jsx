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

var Add = require('./Add.jsx');
var Fasta = require('./Fasta.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var HostFiles = React.createClass({

    propTypes: {
        collection: React.PropTypes.object.isRequired,
        hostsCollection: React.PropTypes.object.isRequired
    },

    getInitialState: function () {
        return {
            documents: this.props.collection.documents,
            show: false,
            target: null
        }
    },

    componentDidMount: function () {
        // Listen for updates to the host files collection. Also tell the server to listen for changes in the files
        // directory and update the collection with any changes.
        this.props.collection.on('change', this.update);
        dispatcher.listen('files');
    },

    componentWillUnmount: function () {
        // Stop listening for changes to the collection and tell the server that we don't want to watch for changes to
        // the host files anymore.
        this.props.collection.off('change', this.update);
        dispatcher.unlisten('files');
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state !== nextState;
    },

    /**
     * Opens the add file modal form. Triggered by clicking the 'add' button on a FASTA document.
     *
     * @param target {object} - object describing the host file to be added.
     * @func
     */
    add: function (target) {
        this.setState({
            show: true,
            target: target
        });
    },

    /**
     * Hides the add modal form. Passed as a value of the 'onHide' prop.
     *
     * @func
     */
    hideModal: function () {
        this.setState({show: false, target: null});
    },

    /**
     * Update the host file documents based on the files collection.
     *
     * @func
     */
    update: function () {
        this.setState({documents: this.props.collection.documents});
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
                <Add
                    onHide={this.hideModal}
                    hostsCollection={this.props.hostsCollection}
                    show={this.state.show}
                    target={this.state.target}
                />
            </div>
        )
    }
});

module.exports = HostFiles;