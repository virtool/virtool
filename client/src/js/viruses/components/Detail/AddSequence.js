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
import { Row, Col, Modal, FormGroup, FormControl, InputGroup, ControlLabel, Popover, Overlay } from "react-bootstrap";
import { ClipLoader } from "halogenium";

import SequenceField from "./SequenceField";
import { addSequence, hideVirusModal } from "../../actions";
import { Button, Icon, Input } from "../../../base";
import { getGenbank } from "../../api";

const getInitialState = () => ({
    id: "",
    definition: "",
    host: "",
    sequence: "",
    autofillPending: false,
    error: false
});

class AddSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleAutofill = () => {
        this.setState({autofillPending: true}, () => {
            getGenbank(this.state.id).then((resp) => {
                // Success
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
                    error: err.status === 404 ? "Accession not found" : false
                });
                return err;
            });
        });
    };

    handleChange = (e) => {
        const { name, value } = e.target;

        this.setState({
            [name]: value,
            error: name === "id" ? false : this.state.error
        });
    };

    handleHideError = () => {
        this.setState({error: false});
    };

    handleModalExited = () => {
        this.setState(getInitialState());
    };

    handleSubmit = (e) => {
        e.preventDefault();

        this.props.onSave(
            this.props.virusId,
            this.props.isolateId,
            this.state.id,
            this.state.definition,
            this.state.host,
            this.state.sequence
        );
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
                                <FormGroup>
                                    <ControlLabel>Accession (ID)</ControlLabel>
                                    <InputGroup>
                                        <Overlay
                                            show={!!this.state.error}
                                            target={this.accessionNode}
                                            placement="top"
                                            container={this}
                                            onHide={this.handleHideError}
                                            animation={false}
                                        >
                                            <Popover id="error-popover">
                                                {this.state.error}
                                            </Popover>
                                        </Overlay>
                                        <FormControl
                                            ref={(node) => this.accessionNode = node}
                                            name="id"
                                            value={this.state.id}
                                            onChange={this.handleChange}
                                        />
                                        <InputGroup.Button>
                                            <Button type="button" onClick={this.handleAutofill}>
                                                <Icon name="wand" />
                                            </Button>
                                        </InputGroup.Button>
                                    </InputGroup>
                                </FormGroup>
                            </Col>
                            <Col xs={12} md={6}>
                                <Input
                                    label="Host"
                                    name="host"
                                    value={this.state.host}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <Input
                                    label="Definition"
                                    name="definition"
                                    value={this.state.definition}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <SequenceField
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
    show: state.viruses.addSequence,
    virusId: state.viruses.detail.id,
    isolateId: state.viruses.activeIsolateId
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onSave: (virusId, isolateId, sequenceId, definition, host, sequence) => {
        dispatch(addSequence(virusId, isolateId, sequenceId, definition, host, sequence));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(AddSequence);

export default Container;
