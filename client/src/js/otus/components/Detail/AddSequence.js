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
import { InputGroup, ControlLabel } from "react-bootstrap";
import { get, find, concat, map } from "lodash-es";
import { addSequence, hideOTUModal } from "../../actions";

import { clearError } from "../../../errors/actions";

import { Button, Icon, InputError, Loader, Box, ModalDialog, DialogBody } from "../../../base";
import { getGenbank } from "../../api";
import { getTargetChange } from "../../../utils/utils";
import { StyledAccessionSegmentCol } from "./AccessionSegment";
import SequenceForm from "./SequenceForm";
import { SegmentCol } from "./SegmentCol";
import { TargetInfo } from "./Target";

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
                    const { accession, definition, host, sequence } = resp.body;

                    this.setState({
                        autofillPending: false,
                        id: accession,
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
                this.state.segment,
                this.props.targetName
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
        const defaultOption = (
            <option key="None" value="">
                {" "}
                - None -{" "}
            </option>
        );
        const segmentNames = concat(
            defaultOption,
            map(this.props.schema, segment => (
                <option key={segment} value={segment}>
                    {segment}
                </option>
            ))
        );
        const AccessionCol = (
            <div>
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
            </div>
        );

        let AccessionSegmentCol = (
            <StyledAccessionSegmentCol>
                {AccessionCol}
                <SegmentCol
                    segmentNames={segmentNames}
                    value={this.state.segment}
                    onChange={this.handleChange}
                    error={this.state.errorSegment}
                />
            </StyledAccessionSegmentCol>
        );

        if (this.props.dataType === "barcode") {
            AccessionSegmentCol = AccessionCol;
        }
        const targetComponent = this.props.targets ? (
            <Box>
                <TargetInfo {...this.props} />
            </Box>
        ) : null;

        return (
            <ModalDialog
                headerText="Add Sequence"
                label="AddSequence"
                show={this.props.show}
                onHide={this.props.onHide}
                onExited={this.handleModalExited}
            >
                <DialogBody>{targetComponent}</DialogBody>
                <SequenceForm
                    host={this.state.host}
                    definition={this.state.definition}
                    sequence={this.state.sequence}
                    overlay={overlay}
                    AccessionSegmentCol={AccessionSegmentCol}
                    handleChange={this.handleChange}
                    handleSubmit={this.handleSubmit}
                    errorDefinition={this.state.errorDefinition}
                    errorSequence={this.state.errorSequence}
                />
            </ModalDialog>
        );
    }
}

const mapStateToProps = state => {
    return {
        sequences: state.otus.activeIsolate.sequences,
        show: state.otus.addSequence,
        targetName: state.otus.targetName,
        otuId: state.otus.detail.id,
        isolateId: state.otus.activeIsolateId,
        error: get(state, "errors.ADD_SEQUENCE_ERROR", ""),
        dataType: state.references.detail.data_type,
        targets: state.references.detail.targets
    };
};

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, isolateId, sequenceId, definition, host, sequence, segment, target) => {
        dispatch(addSequence(otuId, isolateId, sequenceId, definition, host, sequence, segment, target));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddSequence);
