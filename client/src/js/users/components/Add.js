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
import PropTypes from "prop-types";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { Icon, Input, Checkbox, Button } from "../../base";

const getInitialState = () => ({
    username: "",
    password: "",
    confirm: "",
    error: false,
    forceReset: false
});

/**
 * A form for adding a new user. Defines username, role, password, and whether the new user should be forced to reset
 * their password.
 *
 * @class
 */
export default class AddUser extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        add: PropTypes.func.isRequired,
        onHide: PropTypes.func.isRequired,
        show: PropTypes.bool.isRequired
    };

    componentWillUpdate (nextProps, nextState) {
        if (nextState.username !== this.state.username) {
            this.setState({error: false});
        }
    }

    handleSubmit = (event) => {
        event.preventDefault();

        this.props.add(
            {_id: this.state.username, password: this.state.password, force_reset: this.state.forceReset},
            () => this.setState(getInitialState(), () => this.props.onHide()),
            () => this.setState({error: true})
        );
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
                                onChange={() => this.setState({username: e.target.value})}
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
