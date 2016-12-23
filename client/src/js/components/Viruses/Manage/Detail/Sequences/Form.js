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

import React from "react";
import ReactDOM from "react-dom";
import { Row, Col, Overlay, Popover, FormGroup, ControlLabel, FormControl, InputGroup } from "react-bootstrap";
import { Icon, Input, Button, SequenceField } from "virtool/js/components/Base";

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
            if (this.props.mode === "edit") ReactDOM.findDOMNode(this.refs.host).focus();
            if (this.props.mode === "add") ReactDOM.findDOMNode(this.refs.accession).focus();
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
    },

    render: function () {
        var overlay;

        var sharedProps = {
            spellCheck: false,
            readOnly: this.props.mode === "read",
            onChange: this.handleChange
        };

        var accession = (
            <FormControl
                {...sharedProps}
                ref="accession"
                type="text"
                name="sequenceId"
                value={this.props.sequenceId}
                readOnly={this.props.mode !== "add"}
            />
        );

        if (this.props.mode === "add") {
            accession = (
                <InputGroup>
                    {accession}
                    <InputGroup.Button>
                        <Button onClick={this.props.autofill}>
                            <Icon name='wand' />
                        </Button>
                    </InputGroup.Button>
                </InputGroup>
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



        return (
            <form onSubmit={this.onSubmit}>
                {overlay}

                <Row>
                    <Col md={6}>
                        <FormGroup>
                            <ControlLabel>Accession</ControlLabel>
                            {accession}
                        </FormGroup>
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
