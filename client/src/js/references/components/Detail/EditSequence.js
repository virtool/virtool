/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IsolateAdd
 */

import React from "react";
import { find, map, get } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Modal, FormGroup, FormControl, ControlLabel } from "react-bootstrap";

import { editSequence, hideVirusModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button, InputError } from "../../../base";
import SequenceField from "./SequenceField";

const getInitialState = (props) => {

    if (props.sequenceId) {
        const isolate = {...props.isolate};
        const sequence = find(isolate.sequences, {id: props.sequenceId});

        return {
            definition: sequence.definition,
            host: sequence.host,
            sequence: sequence.sequence,
            segment: sequence.segment,
            autofillPending: false,
            error: ""
        };
    }

    return {
        definition: "",
        host: "",
        sequence: "",
        segment: "",
        autofillPending: false,
        error: ""
    };
};

class EditSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    componentWillReceiveProps (nextProps) {
        if (!this.props.error && nextProps.error) {
            this.setState({ error: nextProps.error });
        }
    }

    handleChange = (e) => {
        const { name, value } = e.target;

        this.setState({
            [name]: value,
            error: ""
        });

        if (this.props.error) {
            this.props.onClearError("EDIT_SEQUENCE_ERROR");
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleHide = () => {
        this.props.onHide();

        if (this.props.error) {
            this.props.onClearError("EDIT_SEQUENCE_ERROR");
        }
    };

    handleSubmit = (e) => {
        e.preventDefault();

        this.props.onSave(
            this.props.virusId,
            this.props.isolateId,
            this.props.sequenceId,
            this.state.definition,
            this.state.host,
            this.state.sequence,
            this.state.segment
        );
    };

    render () {

        let overlay;

        if (this.state.autofillPending) {
            overlay = (
                <div className="modal-body-overlay">
                    <span>
                        Loading
                    </span>
                </div>
            );
        }

        const currentOption = this.state.segment
            ? (<option key={this.state.segment} value={this.state.segment}>{this.state.segment}</option>)
            : null;
        const defaultOption = (<option key="" value=""> - None - </option>);
        const segmentNames = map(this.props.schema, (segment) =>
            <option key={segment} value={segment}>
                {segment}
            </option>
        );

        return (
            <Modal show={!!this.props.sequenceId} onEnter={this.handleModalEnter} onHide={this.handleHide}>
                <Modal.Header onHide={this.handleHide} closeButton>
                    Edit Sequence
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        {overlay}

                        <Row>
                            <Col xs={12} md={6}>
                                <InputError
                                    label="Accession (ID)"
                                    name="id"
                                    value={this.props.sequenceId}
                                    readOnly
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <InputError
                                    type="select"
                                    label="Segment"
                                    name="segment"
                                    value={this.state.segment}
                                    onChange={this.handleChange}
                                    error={this.state.error}
                                >
                                    {defaultOption}
                                    {currentOption}
                                    {segmentNames}
                                </InputError>
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <FormGroup>
                                    <ControlLabel>Host</ControlLabel>
                                    <FormControl
                                        name="host"
                                        value={this.state.host}
                                        onChange={this.handleChange}
                                    />
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <FormGroup>
                                    <ControlLabel>Definition</ControlLabel>
                                    <FormControl
                                        name="definition"
                                        value={this.state.definition}
                                        onChange={this.handleChange}
                                    />
                                </FormGroup>
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <SequenceField
                                    name="sequence"
                                    sequence={this.state.sequence}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="floppy">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    detail: state.viruses.detail,
    isolate: state.viruses.activeIsolate,
    sequenceId: state.viruses.editSequence,
    virusId: state.viruses.detail.id,
    error: get(state, "errors.EDIT_SEQUENCE_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onSave: (virusId, isolateId, sequenceId, definition, host, sequence, segment) => {
        dispatch(editSequence(virusId, isolateId, sequenceId, definition, host, sequence, segment));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(EditSequence);
