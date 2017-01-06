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
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { Icon, Input, Checkbox, Button } from "virtool/js/components/Base";

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
        add: React.PropTypes.func.isRequired,
        onHide: React.PropTypes.func.isRequired,
        show: React.PropTypes.bool.isRequired
    };

    componentWillUpdate (nextProps, nextState) {
        if (nextState.username !== this.state.username) {
            this.setState({error: false});
        }
    }

    modalEnter = () => {
        this.usernameNode.focus();
    };

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.props.add(
            {_id: this.state.username, password: this.state.password, force_reset: this.state.forceReset},
            () => this.setState(getInitialState(), () => this.props.onHide()),
            () => this.setState({error: true})
        );
    };

    toggleForceReset = () => {
        this.setState({forceReset: !this.state.forceReset});
    };

    render = () => (
        <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
            <Modal.Header onHide={this.props.onHide} closeButton>
                Add User
            </Modal.Header>
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <Row>
                        <Col sm={12}>
                            <Input
                                type="text"
                                ref={(input) => this.usernameNode = input}
                                name="username"
                                label="Username"
                                value={this.state.username}
                                onChange={this.handleChange}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={6}>
                            <Input
                                type="password"
                                name="password"
                                label="Password"
                                value={this.state.password}
                                onChange={this.handleChange}/>
                        </Col>
                        <Col sm={6}>
                            <Input
                                type="password"
                                name="confirm"
                                label="Confirm"
                                value={this.state.confirm}
                                onChange={this.handleChange}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col sm={12}>
                            <div onClick={this.toggleForceReset} className="pointer">
                                <Checkbox checked={this.state.forceReset}/> Force user to reset password on login
                            </div>
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
