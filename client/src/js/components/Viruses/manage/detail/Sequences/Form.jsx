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
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Input = require('react-bootstrap/lib/Input');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var SequenceField = require('./SequenceField.jsx');

/**
 * A form-based component that is used for adding, editing, and readomg sequence records. When reading, the form
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
        onChange: React.PropTypes.func,
        onSubmit: React.PropTypes.func,
        onAutofill: React.PropTypes.func,

        // Set to true when the form is being used to edit a sequence, not add it. This disables changing the accession
        // value.
        update: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            sequenceId: '',
            definition: '',
            host: '',
            sequence: '',
            update: true
        };
    },

    componentDidMount: function () {
        // If the form is not readOnly, focus on the first input field.
        if (this.props.onChange) {
            this.props.update ? this.refs.host.getInputDOMNode().focus(): this.getAccessionNode().focus();
        }
    },

    /**
     * Get the DOM node of the accession input field.
     *
     * @returns {object} - the input element node.
     * @func
     */
    getAccessionNode: function () {
        return this.refs.accession.getInputDOMNode();
    },

    /**
     * Calls the onChange prop function with the input change object. Triggered by a change event in any of the form
     * input elements.
     *
     * @param event {object} - the input change event.
     * @func
     */
    handleChange: function (event) {
        this.props.onChange(event);
    },

    render: function () {
        // An addon for the accession field that allows the user to pull data for the virus accession from NCBI.
        var autofillAddon;

        if (this.props.onAutofill) {
            autofillAddon = (
                <PushButton onClick={this.props.onAutofill}>
                    <Icon name='wand' />
                </PushButton>
            );
        }

        // If the form has no event handler for the 'change' event, it is implied that it is read-only. This variable
        // will be set to true.
        var readOnly = !this.props.onChange;

        return (
            <form onSubmit={this.props.onSubmit}>
                <Row>
                    <Col md={6}>
                        <Input
                            type='text'
                            name='sequenceId'
                            label='Accession'
                            readOnly={readOnly}
                            value={this.props.sequenceId}
                            onChange={this.handleChange}
                            ref='accession'
                            buttonAfter={autofillAddon}
                            spellCheck={false}
                            disabled={this.props.update}
                        />
                    </Col>
                    <Col md={6}>
                        <Input
                            type='text'
                            name='host'
                            label='Host'
                            ref='host'
                            readOnly={readOnly}
                            value={this.props.host}
                            onChange={this.handleChange}
                            placeholder={readOnly ? '': 'eg. Ageratum conyzoides'}
                            spellCheck={false}
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
                            readOnly={readOnly}
                            value={this.props.definition}
                            onChange={this.handleChange}
                            placeholder='eg. Ageratum enation virus, complete genome'
                            spellCheck={false}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <SequenceField
                            readOnly={readOnly}
                            sequence={this.props.sequence}
                            onChange={this.handleChange}
                            spellCheck={false}
                            ref='sequence'
                        />
                    </Col>
                </Row>
            </form>
        );
    }
});

module.exports = SequenceForm;
