import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { pick, find } from "lodash-es";

import { createUser } from "../actions";
import { Icon, InputError, Checkbox, Button } from "../../base";
import { routerLocationHasState } from "../../utils";

const getInitialState = () => ({
    userId: "",
    password: "",
    confirm: "",
    forceReset: false,
    errors: []
});

export class CreateUser extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            errors: []
        });
    };

    handleToggleForceReset = () => {
        this.setState({
            forceReset: !this.state.forceReset
        });
    };

    handleSubmit = (e) => {
        e.preventDefault();

        const errors = [];

        if (!this.state.userId) {
            errors.push({
                id: 0,
                message: "Please specify a username"
            });
        }

        if (!this.state.password || this.state.password.length < this.props.minPassLen) {
            errors.push({
                id: 1,
                message: `Passwords must contain at least ${this.props.minPassLen} characters`
            });
        }

        if (this.state.confirm !== this.state.password) {
            errors.push({
                id: 2,
                message: "Passwords do not match"
            });
        }

        if (errors.length) {
            this.setState({errors});
            return;
        }

        this.props.onCreate(pick(this.state, ["userId", "password", "confirm", "forceReset"]));
    };

    render () {

        const errorUserName = find(this.state.errors, ["id", 0]) ? find(this.state.errors, ["id", 0]).message : null;
        const errorPassLen = find(this.state.errors, ["id", 1]) ? find(this.state.errors, ["id", 1]).message : null;
        const errorPassMatch = find(this.state.errors, ["id", 2]) ? find(this.state.errors, ["id", 2]).message : null;

        return (
            <Modal show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create User
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col xs={12}>
                                <InputError
                                    label="Username"
                                    name="userId"
                                    value={this.state.userId}
                                    onChange={this.handleChange}
                                    error={errorUserName}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col xs={6}>
                                <InputError
                                    type="password"
                                    label="Password"
                                    name="password"
                                    value={this.state.password}
                                    onChange={this.handleChange}
                                    error={errorPassLen}
                                />
                            </Col>
                            <Col xs={6}>
                                <InputError
                                    type="password"
                                    label="Confirm"
                                    name="confirm"
                                    value={this.state.confirm}
                                    onChange={this.handleChange}
                                    error={errorPassMatch}
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
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createUser"),
    error: state.users.createError,
    pending: state.users.createPending,
    minPassLen: state.settings.data.minimum_password_length
});

const mapDispatchToProps = dispatch => ({

    onCreate: (data) => {
        dispatch(createUser(data));
    },

    onHide: () => {
        dispatch(push({...window.location, state: {createUser: false}}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CreateUser);
