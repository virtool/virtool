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
import PropTypes from "prop-types";
import { find } from "lodash";
import { connect } from "react-redux";
import { Row, Col, Modal, FormGroup, FormControl, InputGroup, ControlLabel } from "react-bootstrap";

import { editSequence, hideVirusModal } from "../../actions";
import { Button, Icon } from "../../../base";
import SequenceField from "./SequenceField";
import virusAPI from "../../api";

const getInitialState = (props) => {
    if (props.sequenceId) {
        const isolate = find(props.detail.isolates, {id: props.isolateId});
        const sequence = find(isolate.sequences, {id: props.sequenceId});

        return {
            definition: sequence.definition,
            host: sequence.host,
            sequence: sequence.sequence,
            autofillPending: false
        }
    }

    return {
        definition: "",
        host: "",
        sequence: "",
        autofillPending: false
    }
};

class EditSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    static propTypes = {
        virusId: PropTypes.string,
        isolateId: PropTypes.string,
        sequenceId: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        detail: PropTypes.object,
        onHide: PropTypes.func,
        onSave: PropTypes.func
    };

    modalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    save = (event) => {
        event.preventDefault();

        this.props.onSave(
            this.props.virusId,
            this.props.isolateId,
            this.props.sequenceId,
            this.state.definition,
            this.state.host,
            this.state.sequence
        );
    };

    autofill = () => {
        this.setState({autofillPending: true}, () => {
            virusAPI.getGenbank(this.props.sequenceId).then((resp) => {
                // Success
                const { definition, host, sequence } = resp.body;

                this.setState({
                    autofillPending: false,
                    definition,
                    host,
                    sequence
                });
            }, () => {
                this.setState({autofillPending: false});
            })
        });
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
            )
        }

        return (
            <Modal show={!!this.props.sequenceId} onEnter={this.modalEnter} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Sequence
                </Modal.Header>

                <form onSubmit={this.save}>
                    <Modal.Body>
                        {overlay}


                            <Row>
                                <Col xs={12}  md={6}>
                                    <FormGroup>
                                        <ControlLabel>Accession (ID)</ControlLabel>
                                        <InputGroup>
                                            <FormControl
                                                value={this.props.sequenceId}
                                                readOnly
                                            />
                                            <InputGroup.Button>
                                                <Button onClick={this.autofill}>
                                                    <Icon name="wand"  />
                                                </Button>
                                            </InputGroup.Button>
                                        </InputGroup>
                                    </FormGroup>
                                </Col>
                                <Col xs={12} md={6}>
                                    <FormGroup>
                                        <ControlLabel>Host</ControlLabel>
                                        <FormControl
                                            value={this.state.host}
                                            onChange={(e) => this.setState({host: e.target.value})}
                                        />
                                    </FormGroup>
                                </Col>
                            </Row>
                            <Row>
                                <Col xs={12}>
                                    <FormGroup>
                                        <ControlLabel>Definition</ControlLabel>
                                        <FormControl
                                            value={this.state.definition}
                                            onChange={(e) => this.setState({definition: e.target.value})}
                                        />
                                    </FormGroup>
                                </Col>
                            </Row>
                            <Row>
                                <Col xs={12}>
                                    <SequenceField
                                        sequence={this.state.sequence}
                                        onChange={(e) => this.setState({sequence: e.target.value})}
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

const mapStateToProps = (state) => {
    return {
        sequenceId: state.viruses.editSequence,
        detail: state.viruses.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(hideVirusModal());
        },

        onSave: (virusId, isolateId, sequenceId, definition, host, sequence) => {
            dispatch(editSequence(virusId, isolateId, sequenceId, definition, host, sequence))
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(EditSequence);

export default Container;
