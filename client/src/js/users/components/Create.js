import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";

import { createUser } from "../actions";
import { Icon, Input, Checkbox, Button } from "../../base";
import { routerLocationHasState } from "../../utils";

import {pushHistoryState} from "../../sagaUtils";

const getInitialState = () => ({
    userId: "",
    password: "",
    confirm: "",
    forceReset: false
});

export class CreateUser extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        this.setState({
            [name]: value
        });
    };

    handleToggleForceReset = () => {
        this.setState({
            forceReset: !this.state.forceReset
        });
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onCreate(this.state);
    };

    render = () => (
        <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
            <Modal.Header onHide={this.props.onHide} closeButton>
                Create User
            </Modal.Header>
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <Row>
                        <Col xs={12}>
                            <Input
                                label="Username"
                                name="userId"
                                value={this.state.userId}
                                onChange={this.handleChange}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={6}>
                            <Input
                                type="password"
                                label="Password"
                                name="password"
                                value={this.state.password}
                                onChange={this.handleChange}
                            />
                        </Col>
                        <Col xs={6}>
                            <Input
                                type="password"
                                label="Confirm"
                                name="confirm"
                                value={this.state.confirm}
                                onChange={this.handleChange}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <Checkbox
                                label="Force user to reset password on login"
                                checked={this.state.forceReset}
                                onClick={this.handleToggleForceReset}
                            />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button bsStyle="primary" type="submit">
                            <Icon name="floppy" /> Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </form>
        </Modal>
    );
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createUser"),
    error: state.users.createError,
    pending: state.users.createPending
});

const mapDispatchToProps = dispatch => ({

    onCreate: (data) => {
        dispatch(createUser(data));
    },

    onHide: () => {
        dispatch(pushHistoryState({createUser: false}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CreateUser);
