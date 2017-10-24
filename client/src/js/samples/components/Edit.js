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
import { get } from "lodash";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Row, Col, Modal, FormGroup, ControlLabel, FormControl } from "react-bootstrap";

import { editSample } from "../actions";
import { listSubtractionIds } from "../../subtraction/actions";
import { Icon, Button } from "../../base";

const getInitialState = (props) => {
    return {
        name: props.name || "",
        isolate: props.isolate || "",
        host: props.host || "",
        subtraction: props.subtraction.id || null
    };
};

class EditSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.detail);
    }

    modalEnter = () => {
        this.props.onListSubtractionIds();
        this.setState(getInitialState(this.props.detail))
    };

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onEdit(this.props.id, this.state.name, this.state.isolate, this.state.host, this.state.subtraction);
    };

    render () {

        let error;

        if (this.props.error) {
            error = (
                <p className="text-danger">
                    <Icon name="warning" /> {this.props.error}
                </p>
            );
        }

        let subtractionOptions;

        if (this.props.subtractionIds) {
            subtractionOptions = this.props.subtractionIds.map(subtractionId =>
                <option key={subtractionId} value={subtractionId}>{subtractionId}</option>
            )
        }

        return (
            <Modal show={this.props.show} onEnter={this.modalEnter} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Sample
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col xs={12} md={6}>
                                <FormGroup>
                                    <ControlLabel>Name</ControlLabel>
                                    <FormControl
                                        type="text"
                                        value={this.state.name}
                                        onChange={(e) => this.setState({name: e.target.value})}
                                    />
                                </FormGroup>
                            </Col>
                            <Col xs={12} md={6}>
                                <FormGroup>
                                    <ControlLabel>Isolate</ControlLabel>
                                    <FormControl
                                        type="text"
                                        value={this.state.isolate}
                                        onChange={(e) => this.setState({isolate: e.target.value})}
                                    />
                                </FormGroup>
                            </Col>
                            <Col xs={12} md={6}>
                                <FormGroup>
                                    <ControlLabel>Host</ControlLabel>
                                    <FormControl
                                        type="text"
                                        value={this.state.host}
                                        onChange={(e) => this.setState({host: e.target.value})}
                                    />
                                </FormGroup>
                            </Col>
                            <Col xs={12} md={6}>
                                <FormGroup>
                                    <ControlLabel>Subtraction</ControlLabel>
                                    <FormControl
                                        componentClass="select"
                                        value={this.state.subtraction}
                                        disabled={this.props.subtractionIds === null}
                                        onChange={(e) => this.setState({subtraction: e.target.value})}
                                    >
                                        {subtractionOptions}
                                    </FormControl>
                                </FormGroup>
                            </Col>
                        </Row>

                        {error}

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
        detail: state.samples.detail,
        subtractionIds: state.subtraction.ids,
        show: get(state.router.location.state, "editSample", false),
        error: state.samples.editError
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onListSubtractionIds: () => {
            dispatch(listSubtractionIds());
        },

        onHide: () => {
            dispatch(push({state: {showEdit: false}}));
        },

        onEdit: (sampleId, name, isolate, host, subtraction) => {
            dispatch(editSample(sampleId, name, isolate, host, subtraction))
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(EditSample);

export default Container;
