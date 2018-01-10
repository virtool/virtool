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
import { connect } from "react-redux";
import { Row, Col, Modal, FormGroup, FormControl, InputGroup, ControlLabel, Popover, Overlay } from "react-bootstrap";
import { ClipLoader } from "halogenium";

import { addSequence, hideVirusModal } from "../../actions";
import { Button, Icon, Input } from "../../../base";
import SequenceField from "./SequenceField";
import virusAPI from "../../api";

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
        this.state = getInitialState(this.props);
    }

    static propTypes = {
        virusId: PropTypes.string,
        isolateId: PropTypes.string,
        show: PropTypes.bool,
        onHide: PropTypes.func,
        onSave: PropTypes.func
    };

    save = (e) => {
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

    autofill = () => {
        this.setState({autofillPending: true}, () => {
            virusAPI.getGenbank(this.state.id).then((resp) => {
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
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
                onEntered={this.modalEntered}
                onExited={() => this.setState(getInitialState())}
            >
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Add Sequence
                </Modal.Header>
                <Modal.Body>
                    {overlay}

                    <form onSubmit={this.save}>
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
                                            onHide={() => this.setState({error: false})}
                                            animation={false}
                                        >
                                            <Popover id="error-popover">
                                                {this.state.error}
                                            </Popover>
                                        </Overlay>
                                        <FormControl
                                            inputRef={(node) => this.accessionNode = node}
                                            value={this.state.id}
                                            onChange={(e) => this.setState({id: e.target.value, error: false})}
                                        />
                                        <InputGroup.Button>
                                            <Button type="button" onClick={this.autofill}>
                                                <Icon name="wand" />
                                            </Button>
                                        </InputGroup.Button>
                                    </InputGroup>
                                </FormGroup>
                            </Col>
                            <Col xs={12} md={6}>
                                <Input
                                    label="Host"
                                    value={this.state.host}
                                    onChange={(e) => this.setState({host: e.target.value})}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={12}>
                                <Input
                                    label="Definition"
                                    value={this.state.definition}
                                    onChange={(e) => this.setState({definition: e.target.value})}
                                />
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
                    </form>
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" icon="floppy" onClick={this.save}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: state.viruses.addSequence
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
