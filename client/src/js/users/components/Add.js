/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddUser
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";

import { addUser } from "../actions";
import { Icon, Input, Checkbox, Button } from "../../base";

const getInitialState = () => ({
    username: "",
    password: "",
    confirm: "",
    forceReset: false
});

/**
 * A form for adding a new user. Defines username, role, password, and whether the new user should be forced to reset
 * their password.
 *
 * @class
 */
class AddUser extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onAdd(this.state.username, this.state.password, this.state.forceReset);
    };

    render = () => (
        <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
            <Modal.Header onHide={this.props.onHide} closeButton>
                Add User
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
        error: state.users.addError,
        pending: state.users.addPending
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onAdd: (userId, password, forceReset) => {
            dispatch(addUser(userId, password, forceReset));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(AddUser);

export default Container;