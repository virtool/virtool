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
import { connect } from "react-redux";
import { Col, Modal, InputGroup, ControlLabel } from "react-bootstrap";
import { get, find } from "lodash-es";

import { addSequence, hideOTUModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button, Icon, InputError, Loader } from "../../../base";
import { getGenbank } from "../../api";
import { getTargetChange } from "../../../utils/utils";
import SequenceForm from "./SequenceForm";

const getInitialState = () => ({
    id: "",
    definition: "",
    host: "",
    sequence: "",
    segment: "",
    autofillPending: false,
    errorId: "",
    errorSegment: "",
    errorDefinition: "",
    errorSequence: "",
    error: null
});

class AddSequence extends React.Component {
    constructor(props) {
        super(props);
        this.state = { show: false, ...getInitialState() };
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (prevState.error !== nextProps.error) {
            if (!nextProps.error) {
                return { error: null };
            }

            let error = "";

            if (nextProps.error.status === 422) {
                error = "Minimum length is 1";

                return {
                    errorId: prevState.id ? "" : error,
                    errorDefinition: prevState.definition ? "" : error,
                    errorSequence: prevState.sequence ? "" : error,
                    error: nextProps.error
                };
            } else if (nextProps.error.status === 404) {
                return {
                    errorSegment: nextProps.error.message,
                    error: nextProps.error
                };
            }
            return { errorId: nextProps.error.message, error: nextProps.error };
        }

        return null;
    }

    handleAutofill = () => {
        this.setState({ autofillPending: true }, () => {
            getGenbank(this.state.id).then(
                resp => {
                    const { definition, host, sequence } = resp.body;

                    this.setState({
                        autofillPending: false,
                        definition,
                        host,
                        sequence,
                        errorId: "",
                        errorSegment: "",
                        errorDefinition: "",
                        errorSequence: ""
                    });
                },
                err => {
                    this.setState({
                        autofillPending: false,
                        error: err.status === 404 ? "Accession not found" : ""
                    });
                    return err;
                }
            );
        });
    };

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name === "host") {
            return this.setState({ [name]: value });
        }

        if (name === "id" && !!find(this.props.sequences, ["accession", value])) {
            return this.setState({
                [name]: value,
                [error]: "Note: entry with this id already exists"
            });
        }

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError("ADD_SEQUENCE_ERROR");
        }
    };

    handleModalExited = () => {
        this.setState(getInitialState());
        if (this.props.error) {
            this.props.onClearError("ADD_SEQUENCE_ERROR");
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.id) {
            this.setState({ show: false });
            this.props.onSave(
                this.props.otuId,
                this.props.isolateId,
                this.state.id,
                this.state.definition,
                this.state.host,
                this.state.sequence,
                this.state.segment
            );
        } else {
            this.setState({
                show: true,
                errorId: "Required Field"
            });
        }
    };

    render() {
        let overlay;

        if (this.state.autofillPending) {
            overlay = (
                <div className="modal-body-overlay">
                    <span>
                        <Loader color="#fff" />
                    </span>
                </div>
            );
        }

        const accessionCol = (
            <Col xs={12} md={6}>
                <ControlLabel>Accession (ID)</ControlLabel>
                <InputGroup>
                    <InputError
                        name="id"
                        value={this.state.id}
                        onChange={this.handleChange}
                        error={this.state.errorId}
                    />
                    <InputGroup.Button style={{ verticalAlign: "top", zIndex: "0" }}>
                        <Button type="button" onClick={this.handleAutofill}>
                            <Icon name="magic" />
                        </Button>
                    </InputGroup.Button>
                </InputGroup>
            </Col>
        );

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Add Sequence
                </Modal.Header>
                <SequenceForm
                    host={this.state.host}
                    definition={this.state.definition}
                    sequence={this.state.sequence}
                    segment={this.state.segment}
                    schema={this.props.schema}
                    overlay={overlay}
                    accessionCol={accessionCol}
                    handleChange={this.handleChange}
                    handleSubmit={this.handleSubmit}
                    errorSegment={this.state.errorSegment}
                    errorDefinition={this.state.errorDefinition}
                    errorSequence={this.state.errorSequence}
                />
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    sequences: state.otus.activeIsolate.sequences,
    show: state.otus.addSequence,
    otuId: state.otus.detail.id,
    isolateId: state.otus.activeIsolateId,
    error: get(state, "errors.ADD_SEQUENCE_ERROR", "")
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, isolateId, sequenceId, definition, host, sequence, segment) => {
        dispatch(addSequence(otuId, isolateId, sequenceId, definition, host, sequence, segment));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AddSequence);
