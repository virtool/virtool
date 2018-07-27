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
import { find, map, upperFirst, concat, union } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";

import { editSequence, hideOTUModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button, InputError } from "../../../base";
import SequenceField from "./SequenceField";

const getInitialState = (props) => {

    if (props.sequenceId) {
        const isolate = {...props.isolate};
        const sequence = find(isolate.sequences, {id: props.sequenceId});

        return {
            definition: sequence.definition,
            host: sequence.host || "",
            sequence: sequence.sequence,
            segment: sequence.segment,
            schema: sequence.segment ? union([sequence.segment], props.schema) : props.schema,
            autofillPending: false,
            errorDefinition: "",
            errorSequence: "",
            error: props.error
        };
    }

    return {
        definition: "",
        host: "",
        sequence: "",
        segment: "",
        autofillPending: false,
        errorDefinition: "",
        errorSequence: "",
        error: ""
    };
};

class EditSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        if (prevState.error !== nextProps.error) {
            return getInitialState(nextProps);
        }
        return null;
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        const error = `error${upperFirst(name)}`;

        this.setState({
            [name]: value,
            [error]: ""
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

        if (!this.state.definition.length) {
            return this.setState({ errorDefinition: "Minimum length is 1" });
        }

        if (!this.state.sequence.length) {
            return this.setState({ errorSequence: "Minimum length is 1" });
        }

        this.props.onSave(
            this.props.otuId,
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

        const defaultOption = <option key="None" value=""> - None - </option>;
        const segmentNames = concat(defaultOption, map(this.state.schema, (segment) => (
            <option key={segment} value={segment}>
                {segment}
            </option>
        )));

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
                                    {segmentNames}
                                </InputError>
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <InputError
                                    label="Host"
                                    name="host"
                                    value={this.state.host}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <InputError
                                    label="Definition"
                                    name="definition"
                                    value={this.state.definition}
                                    onChange={this.handleChange}
                                    error={this.state.errorDefinition}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <SequenceField
                                    name="sequence"
                                    sequence={this.state.sequence}
                                    onChange={this.handleChange}
                                    error={this.state.errorSequence}
                                />
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="save">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    detail: state.otus.detail,
    isolate: state.otus.activeIsolate,
    sequenceId: state.otus.editSequence,
    otuId: state.otus.detail.id
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, isolateId, sequenceId, definition, host, sequence, segment) => {
        dispatch(editSequence(otuId, isolateId, sequenceId, definition, host, sequence, segment));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(EditSequence);
