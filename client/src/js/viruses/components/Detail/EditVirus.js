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
import { Row, Col, Modal, FormGroup, ControlLabel, FormControl } from "react-bootstrap";

import { editVirus, hideVirusModal } from "../../actions";
import { Icon, Button } from "../../../base";

const getInitialState = (props) => ({
    name: props.name || "",
    abbreviation: props.abbreviation || ""
});

class EditVirus extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    modalEnter = () => {
        this.setState(getInitialState(this.props))
    };

    static propTypes = {
        virusId: PropTypes.string,
        name: PropTypes.string,
        abbreviation: PropTypes.string,
        show: PropTypes.bool,
        error: PropTypes.string,
        onHide: PropTypes.func,
        onSave: PropTypes.func
    };

    save = (event) => {
        event.preventDefault();
        this.props.onSave(this.props.virusId, this.state.name, this.state.abbreviation);
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

        return (
            <Modal show={this.props.show} onEnter={this.modalEnter} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Virus
                </Modal.Header>
                <form onSubmit={this.save}>
                    <Modal.Body>
                        <Row>
                            <Col md={6} xs={12}>
                                <FormGroup>
                                    <ControlLabel>Name</ControlLabel>
                                    <FormControl
                                        type="text"
                                        value={this.state.name}
                                        onChange={(e) => this.setState({name: e.target.value})}
                                    />
                                </FormGroup>
                            </Col>
                            <Col md={6} xs={12}>
                                <FormGroup>
                                    <ControlLabel>Abbreviation</ControlLabel>
                                    <FormControl
                                        type="text"
                                        value={this.state.abbreviation}
                                        onChange={(e) => this.setState({abbreviation: e.target.value})}
                                    />
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
        show: state.viruses.edit,
        error: state.viruses.editError
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(hideVirusModal());
        },

        onSave: (virusId, name, abbreviation) => {
            dispatch(editVirus(virusId, name, abbreviation))
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(EditVirus);

export default Container;
