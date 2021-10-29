import { get, pick } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import {
    Checkbox,
    Input,
    InputError,
    InputGroup,
    InputLabel,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PasswordInput,
    SaveButton
} from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange, routerLocationHasState } from "../../utils/utils";
import { createUser } from "../actions";

const getInitialState = () => ({
    handle: "",
    password: "",
    forceReset: false,
    errorHandle: "",
    errorPassword: ""
});

export class CreateUser extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.errorHandle && nextProps.error) {
            return { errorHandle: nextProps.error };
        }
        return null;
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleModalExited = () => {
        this.setState(getInitialState());
        if (this.props.error) {
            this.props.onClearError();
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

        if (!this.state.handle) {
            hasError = true;
            this.setState({ errorHandle: "Please specify a username" });
        }

        if (this.state.password.length < this.props.minimumPasswordLength) {
            hasError = true;
            this.setState({
                errorPassword: `Passwords must contain at least ${this.props.minimumPasswordLength} characters`
            });
        }

        if (!hasError) {
            this.props.onCreate(pick(this.state, ["handle", "password", "confirm", "forceReset"]));
        }
    };

    render() {
        return (
            <Modal
                label="Create User"
                show={this.props.show}
                onHide={this.props.onHide}
                onExited={this.handleModalExited}
            >
                <ModalHeader>Create User</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
                        <InputGroup>
                            <InputLabel>Username</InputLabel>
                            <Input name="handle" value={this.state.handle} onChange={this.handleChange} />
                            <InputError>{this.state.errorHandle}</InputError>
                        </InputGroup>
                        <InputGroup>
                            <InputLabel>Password</InputLabel>
                            <PasswordInput name="password" value={this.state.password} onChange={this.handleChange} />
                            <InputError>{this.state.errorPassword}</InputError>
                        </InputGroup>

                        <Checkbox
                            label="Force user to reset password on login"
                            checked={this.state.forceReset}
                            onClick={this.handleToggleForceReset}
                        />
                    </ModalBody>

                    <ModalFooter>
                        <SaveButton />
                    </ModalFooter>
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

    onClearError: () => {
        dispatch(clearError("CREATE_USER_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateUser);
