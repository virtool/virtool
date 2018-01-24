import React from "react";
import { get } from "lodash-es";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";

import { editSample } from "../actions";
import { Button, Icon, Input } from "../../base";

const getInitialState = (props) => ({
    name: props.name || "",
    isolate: props.isolate || "",
    host: props.host || ""
});

class EditSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    modalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onEdit(this.props.id, this.state);
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
                    Edit Sample
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col xs={12}>
                                <Input
                                    label="Name"
                                    value={this.state.name}
                                    onChange={(e) => this.setState({name: e.target.value})}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <Input
                                    label="Isolate"
                                    value={this.state.isolate}
                                    onChange={(e) => this.setState({isolate: e.target.value})}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <Input
                                    label="Host"
                                    value={this.state.host}
                                    onChange={(e) => this.setState({host: e.target.value})}
                                />
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

const mapStateToProps = (state) => ({
    ...state.samples.detail,
    show: get(state.router.location.state, "editSample", false),
    error: state.samples.editError
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(push({state: {showEdit: false}}));
    },

    onEdit: (sampleId, update) => {
        dispatch(editSample(sampleId, update));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(EditSample);

export default Container;
