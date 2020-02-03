import { get, pick } from "lodash-es";
import React from "react";
import { Modal } from "react-bootstrap";
import { connect } from "react-redux";

import styled from "styled-components";
import { pushState } from "../../app/actions";
import { Checkbox, device, InputError, SaveButton } from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange, routerLocationHasState } from "../../utils/utils";
import { createUser } from "../actions";

const CreateUserContainer = styled.div`
    margin: 15px;
`;

const CreateUserPasswords = styled.div`
    display: grid;
    grid-gap: 15px;
    grid-template-columns: 1fr;

    @media (min-width: ${device.desktop}) {
        grid-template-columns: 1fr 1fr;
    }
`;

const getInitialState = () => ({
    userId: "",
    password: "",
    confirm: "",
    forceReset: false,
    errorUserId: "",
    errorPassword: "",
    errorConfirm: ""
});

export class CreateUser extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.errorUserId && nextProps.error) {
            return { errorUserId: nextProps.error };
        }
        return null;
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError("CREATE_USER_ERROR");
        }
    };

    handleModalExited = () => {
        this.setState(getInitialState());
        if (this.props.error) {
            this.props.onClearError("CREATE_USER_ERROR");
        }
    };

    handleToggleForceReset = () => {
        this.setState({
            forceReset: !this.state.forceReset
        });
    };

    handleSubmit = e => {
        e.preventDefault();

        let hasError = false;
        if (!this.state.userId) {
            hasError = true;
            this.setState({ errorUserId: "Please specify a username" });
        }

        if (this.state.password.length < this.props.minimumPasswordLength) {
            hasError = true;
            this.setState({
                errorPassword: `Passwords must contain at least ${this.props.minimumPasswordLength} characters`
            });
        }

        if (this.state.confirm !== this.state.password) {
            hasError = true;
            this.setState({ errorConfirm: "Passwords do not match" });
        }

        if (!hasError) {
            this.props.onCreate(pick(this.state, ["userId", "password", "confirm", "forceReset"]));
        }
    };

    render() {
        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create User
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <CreateUserContainer>
                        <InputError
                            label="Username"
                            name="userId"
                            value={this.state.userId}
                            onChange={this.handleChange}
                            error={this.state.errorUserId}
                        />

                        <CreateUserPasswords>
                            <InputError
                                type="password"
                                label="Password"
                                name="password"
                                value={this.state.password}
                                onChange={this.handleChange}
                                error={this.state.errorPassword}
                            />
                            <InputError
                                type="password"
                                label="Confirm"
                                name="confirm"
                                value={this.state.confirm}
                                onChange={this.handleChange}
                                error={this.state.errorConfirm}
                            />
                        </CreateUserPasswords>

                        <Checkbox
                            label="Force user to reset password on login"
                            checked={this.state.forceReset}
                            onClick={this.handleToggleForceReset}
                        />
                    </CreateUserContainer>

                    <Modal.Footer>
                        <SaveButton pullRight />
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createUser"),
    pending: state.users.createPending,
    minimumPasswordLength: state.settings.data.minimum_password_length,
    error: get(state, "errors.CREATE_USER_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onCreate: data => {
        dispatch(createUser(data));
    },

    onHide: () => {
        dispatch(pushState({ createUser: false }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateUser);
