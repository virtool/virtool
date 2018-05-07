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
import { Row, Col, Modal, InputGroup, ControlLabel } from "react-bootstrap";
import { ClipLoader } from "halogenium";
import { map, get, upperFirst } from "lodash-es";

import SequenceField from "./SequenceField";
import { addSequence, hideOTUModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button, Icon, InputError } from "../../../base";
import { getGenbank } from "../../api";

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
    errorSequence: ""
});

class AddSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = {show: false, ...getInitialState()};
    }

    componentWillReceiveProps (nextProps) {
        if (!this.props.error && nextProps.error) {
            let error = "";

            if (nextProps.error.status === 422) {
                error = "Minimum length is 1";

                this.setState({
                    errorId: this.state.id ? "" : error,
                    errorDefinition: this.state.definition ? "" : error,
                    errorSequence: this.state.sequence ? "" : error

                });
            } else if (nextProps.error.status === 404) {
                this.setState({ errorSegment: nextProps.error.message });
            } else {
                this.setState({ errorId: nextProps.error.message });
            }
        }
    }

    handleAutofill = () => {
        this.setState({autofillPending: true}, () => {
            getGenbank(this.state.id).then((resp) => {
                const { definition, host, sequence } = resp.body;

                this.setState({
                    autofillPending: false,
                    definition,
                    host,
                    sequence
                });
            }, (err) => {
                this.setState({
                    autofillPending: false,
                    error: err.status === 404 ? "Accession not found" : ""
                });
                return err;
            });
        });
    };

    handleChange = (e) => {
        const { name, value } = e.target;

        if (name === "host") {
            return this.setState({
                [name]: value
            });
        }

        const error = `error${upperFirst(name)}`;

        this.setState({
            [name]: value,
            [error]: ""
        });

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

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.id) {
            this.setState({show: false});
            this.props.onSave(
                this.props.OTUId,
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

    render () {

        let overlay;

        if (this.state.autofillPending) {
            overlay = (
                <div className="modal-body-overlay">
                    <span>
                        <ClipLoader color="#fff" />
                    </span>
                </div>
            );
        }

        const defaultOption = (<option key="" value=""> - None - </option>);

        const segmentNames = map(this.props.schema, (segment) =>
            <option key={segment} value={segment}>
                {segment}
            </option>
        );

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Add Sequence
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        {overlay}
                        <Row>
                            <Col xs={12} md={6}>
                                <ControlLabel>Accession (ID)</ControlLabel>
                                <InputGroup>
                                    <InputError
                                        name="id"
                                        value={this.state.id}
                                        onChange={this.handleChange}
                                        error={this.state.errorId}
                                    />
                                    <InputGroup.Button style={{verticalAlign: "top", zIndex: "0"}}>
                                        <Button type="button" onClick={this.handleAutofill}>
                                            <Icon name="wand" />
                                        </Button>
                                    </InputGroup.Button>
                                </InputGroup>
                            </Col>
                            <Col xs={12} md={6}>
                                <InputError
                                    type="select"
                                    label="Segment"
                                    name="segment"
                                    value={this.state.segment}
                                    onChange={this.handleChange}
                                    error={this.state.errorSegment}
                                >
                                    {defaultOption}
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
    show: state.OTUs.addSequence,
    OTUId: state.OTUs.detail.id,
    isolateId: state.OTUs.activeIsolateId,
    error: get(state, "errors.ADD_SEQUENCE_ERROR", "")
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (OTUId, isolateId, sequenceId, definition, host, sequence, segment) => {
        dispatch(addSequence(OTUId, isolateId, sequenceId, definition, host, sequence, segment));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(AddSequence);
