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

import React from "react";
import { Row, Col, Overlay, Popover, FormGroup, ControlLabel, FormControl, InputGroup } from "react-bootstrap";
import { Icon, Input, Button, SequenceField } from "virtool/js/components/Base";

/**
 * A form-based component that is used for adding, editing, and reading sequence records. When reading, the form
 * cannot be modified. Editing can be toggled on a readOnly form and changes sent to the server.
 *
 * @class
 */
export default class SequenceForm extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingAutofill: false,
            pendingSave: false
        };
    }

    static propTypes = {
        // Data from the sequence document that is used to populate the form. These props will be undefined when the
        // form is being used to add a new sequence.
        sequenceId: React.PropTypes.string,
        definition: React.PropTypes.string,
        host: React.PropTypes.string,
        sequence: React.PropTypes.string,

        // Callback from the parent prop to handle events in the form.
        update: React.PropTypes.func,
        onSubmit: React.PropTypes.func,
        autofill: React.PropTypes.func,

        active: React.PropTypes.bool,
        mode: React.PropTypes.string,

        // Error message to display on the accession field.
        error: React.PropTypes.string
    };

    static defaultProps = () => {
        return {
            sequenceId: "",
            definition: "",
            host: "",
            sequence: "",
            mode: "read"
        };
    };

    componentDidUpdate (prevProps) {
        if (!this.props.active && prevProps.active) {
            if (this.props.mode === "edit") {
                this.hostNode.focus();
            }
            if (this.props.mode === "add") {
                this.accessionNode.focus();
            }
        }
    }

    /**
     * Calls the onChange prop function with the input change object. Triggered by a change event in any of the form
     * input elements.
     *
     * @param event {object} - the input change event.
     * @func
     */
    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.props.update(data);
    };

    onSubmit = (event) => {
        event.preventDefault();
    };

    render () {
        let overlay;

        const sharedProps = {
            spellCheck: false,
            readOnly: this.props.mode === "read",
            onChange: this.handleChange
        };

        let accession = (
            <FormControl
                {...sharedProps}
                inputRef={(node) => this.accessionNode = node}
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
                            <Icon name="wand" />
                        </Button>
                    </InputGroup.Button>
                </InputGroup>
            );

            if (this.props.error) {
                // Set up an overlay to display if there is an error in state.
                const overlayProps = {
                    target: this.accessionNode,
                    placement: "top"
                };

                overlay = (
                    <Overlay {...overlayProps} show={true} onHide={this.dismissError}>
                        <Popover id="sequence-error-popover">
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
                            type="text"
                            name="host"
                            label="Host"
                            value={this.props.host}
                            placeholder={this.props.mode === "edit" ? "eg. Ageratum conyzoides": ""}
                            {...sharedProps}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Input
                            type="text"
                            name="definition"
                            label="Definition"
                            value={this.props.definition}
                            placeholder="eg. Ageratum enation virus, complete genome"
                            {...sharedProps}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <SequenceField
                            sequence={this.props.sequence}
                            {...sharedProps}
                        />
                    </Col>
                </Row>
            </form>
        );
    }
}
