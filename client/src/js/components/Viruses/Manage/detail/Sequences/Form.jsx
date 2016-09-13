/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SequenceForm
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Input = require('react-bootstrap/lib/InputGroup');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var SequenceField = require('./SequenceField.jsx');


/**
 * A regular expression object used to test if a string contains spaces. Used to make sure the there are no spaces in
 * a supplied accession.
 *
 * @type {RegExp}
 * @object
 */
var SpaceRegEx = new RegExp(' ');


/**
 * A form-based component that is used for adding, editing, and reading sequence records. When reading, the form
 * cannot be modified. Editing can be toggled on a readOnly form and changes sent to the server.
 *
 * @class
 */
var SequenceForm = React.createClass({

    propTypes: {
        // Data from the sequence document that is used to populate the form. These props will be undefined when the form
        // is being used to add a new sequence.
        sequenceId: React.PropTypes.string,
        definition: React.PropTypes.string,
        host: React.PropTypes.string,
        sequence: React.PropTypes.string,

        // Callback from the parent prop to handle events in the form.
        update: React.PropTypes.func,
        onSubmit: React.PropTypes.func,
        autofill: React.PropTypes.func,

        mode: React.PropTypes.string,

        // Error message to display on the accession field.
        error: React.PropTypes.string
    },

    getDefaultProps: function () {
        return {
            sequenceId: '',
            definition: '',
            host: '',
            sequence: '',

            mode: "read"
        };
    },

    getInitialState: function () {
        return {
            pendingAutofill: false,
            pendingSave: false
        };
    },

    componentDidUpdate: function (prevProps) {
        if (!this.props.active && prevProps.active) {
            if (this.props.mode === "edit") this.refs.host.getInputDOMNode().focus();
            if (this.props.mode === "add") this.refs.accession.getInputDOMNode().focus();
        }
    },

    /**
     * Calls the onChange prop function with the input change object. Triggered by a change event in any of the form
     * input elements.
     *
     * @param event {object} - the input change event.
     * @func
     */
    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.props.update(data);
    },

    onSubmit: function (event) {
        event.preventDefault();
        console.log("submit");
    },

    render: function () {
        // An addon for the accession field that allows the user to pull data for the virus accession from NCBI.
        var autofillAddon;

        var overlay;

        if (this.props.mode === "add") {
            autofillAddon = (
                <PushButton onClick={this.props.autofill}>
                    <Icon name='wand' />
                </PushButton>
            );

            if (this.props.error) {
                // Set up an overlay to display if there is an error in state.
                var overlayProps = {
                    target: function () {return this.refs.accession.getInputDOMNode()}.bind(this),
                    placement: 'top'
                };

                overlay = (
                    <Overlay {...overlayProps} show={true} onHide={this.dismissError}>
                        <Popover id='sequence-error-popover'>
                            {this.props.error}
                        </Popover>
                    </Overlay>
                );
            }
        }

        var sharedProps = {
            spellCheck: false,
            readOnly: this.props.mode === "read",
            onChange: this.handleChange
        };

        return (
            <form onSubmit={this.onSubmit}>
                {overlay}

                <Row>
                    <Col md={6}>
                        <Input
                            ref='accession'
                            type='text'
                            name='sequenceId'
                            label='Accession'
                            value={this.props.sequenceId}
                            buttonAfter={autofillAddon}
                            {...sharedProps}
                            readOnly={this.props.mode !== "add"}
                        />
                    </Col>
                    <Col md={6}>
                        <Input
                            type='text'
                            name='host'
                            label='Host'
                            ref='host'
                            value={this.props.host}
                            placeholder={this.props.mode === "edit" ? "eg. Ageratum conyzoides": ""}
                            {...sharedProps}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Input
                            type='text'
                            name='definition'
                            ref='definition'
                            label='Definition'
                            value={this.props.definition}
                            placeholder='eg. Ageratum enation virus, complete genome'
                            {...sharedProps}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <SequenceField
                            ref='sequence'
                            sequence={this.props.sequence}
                            {...sharedProps}
                        />
                    </Col>
                </Row>
            </form>
        );
    }
});

module.exports = SequenceForm;
