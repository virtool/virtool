/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesImport
 */

'use strict';

var React = require('react');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var Input = require('react-bootstrap/lib/Input');
var Panel = require('react-bootstrap/lib/Panel');
var Label = require('react-bootstrap/lib/Label');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');

var ReadSelector = require('./Reads.jsx');
var Form = require('./Form.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
var SamplesImport = React.createClass({

    propTypes: {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            nameExistsError: false,
            nameEmptyError: false,
            readError: false
        };
    },

    componentWillReceiveProps: function () {

    },

    /**
     * Send a request to the server
     *
     * @param event {object} - the submit event
     */
    handleSubmit: function (event) {
        event.preventDefault();

        var data = this.refs.form.getValues();

        var nameEmptyError = !data.name;

        // Get the names of the files to attach to the sample record.
        data.files = this.refs.reads.getValue();

        var readError = data.files.length === 0;

        if (readError || nameEmptyError) {
            this.setState({
                readError: readError,
                nameEmptyError: nameEmptyError
            });
        } else {
            // Send the request to the server.
            this.setState(this.getInitialState(), function () {
                dispatcher.collections.samples.request(
                    'new',
                    data,
                    this.onSubmitSuccess,
                    this.onSubmitFailure
                );
            });
        }
    },

    handleExit: function () {
        this.setState(this.getInitialState());
    },

    onSubmitSuccess: function () {
        this.refs.reads.clearSelected();
        this.refs.form.clear();
    },

    onSubmitFailure: function () {
        this.setState({
            nameExistsError: true
        });
    },

    render: function () {

        return (
            <Modal dialogClassName='modal-lg' {...this.props} onEntered={this.handleEntered} onExit={this.handleExit}>
                <Modal.Header {...this.props} closeButton>
                    Create Sample
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body {...this.props}>
                        <Form
                            ref='form'
                            handleSubmit={this.handleSubmit}
                            {...this.state}
                        />
                        <ReadSelector
                            ref='reads'
                            {...this.state}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <PushButton type='submit' bsStyle='primary'>
                            <Icon name='floppy' /> Save
                        </PushButton>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
});

module.exports = SamplesImport;