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

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Row, Col, Modal, FormGroup, FormControl, InputGroup, ControlLabel } from "react-bootstrap";

import { editSequence, hideVirusModal } from "../../actions";
import { Button } from "virtool/js/components/Base";
import SequenceField from "./SequenceField";

const getInitialState = () => ({
    definition: "",
    host: "",
    sequence: ""
});

class EditSequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    static propTypes = {
        virusId: PropTypes.string,
        isolateId: PropTypes.string,
        sequenceId: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
        onHide: PropTypes.func,
        onSave: PropTypes.func
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

    render () {
        return (
            <Modal show={this.props.sequenceId} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Sequence
                </Modal.Header>
                <Modal.Body>
                    <form onSubmit={this.save}>
                        <Row>
                            <Col sm={12}  md={6}>
                                <FormGroup>
                                    <ControlLabel>Accession (ID)</ControlLabel>
                                    <InputGroup>
                                        <FormControl
                                            value={this.props.sequenceId}
                                            readOnly
                                        />
                                    </InputGroup>
                                </FormGroup>
                            </Col>
                            <Col sm={12} md={6}>
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
                            <Col sm={12}>
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
                            <Col sm={12}>
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

const mapStateToProps = (state) => {
    return {
        sequenceId: state.viruses.editSequence
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
