/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";

import { createUser } from "../actions";
import { Icon, Input, Checkbox, Button } from "../../base";

const getInitialState = () => ({
    username: "",
    password: "",
    confirm: "",
    forceReset: false
});

class CreateUser extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onCreate(this.state.username, this.state.password, this.state.forceReset);
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
                                type="text"
                                name="username"
                                label="Username"
                                value={this.state.username}
                                onChange={(e) => this.setState({username: e.target.value})}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={6}>
                            <Input
                                type="password"
                                name="password"
                                label="Password"
                                value={this.state.password}
                                onChange={(e) => this.setState({password: e.target.value})}
                            />
                        </Col>
                        <Col xs={6}>
                            <Input
                                type="password"
                                name="confirm"
                                label="Confirm"
                                value={this.state.confirm}
                                onChange={(e) => this.setState({confirm: e.target.value})}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <Checkbox
                                label="Force user to reset password on login"
                                checked={this.state.forceReset}
                                onClick={() => this.setState({forceReset: !this.state.forceReset})}
                            />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button bsStyle="primary" type="submit">
                            <Icon name="floppy"/> Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </form>
        </Modal>
    );
}

const mapStateToProps = (state) => {
    return {
        error: state.users.createError,
        pending: state.users.createPending
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onCreate: (userId, password, forceReset) => {
            dispatch(createUser(userId, password, forceReset));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(CreateUser);

export default Container;
