import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    InputContainer,
    InputError,
    InputGroup,
    InputLabel,
    LoadingPlaceholder,
    PasswordInput,
    RelativeTime,
    SaveButton
} from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange } from "../../utils/utils";
import { changePassword } from "../actions";

const getInitialState = props => ({
    oldPassword: "",
    newPassword: "",
    errorOldPassword: "",
    errorNewPassword: "",
    error: props.error
});

const ChangePasswordFooter = styled.div`
    align-items: start;
    display: flex;
    margin-top: 15px;

    > span {
        color: ${props => props.theme.color.greyDark};
    }

    button {
        margin-left: auto;
    }
`;

const collectErrors = (props, state) => {
    const message = get(props, "error.message");

    if (message) {
        return {
            ...state,
            errorOldPassword: message,
            error: props.error
        };
    }

    return state;
};

export class ChangePassword extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    onSubmit = e => {
        e.preventDefault();

        let hasError = false;
        const minimumLength = this.props.minimumLength;

        if (!this.state.oldPassword.length) {
            hasError = true;
            this.setState({ errorOldPassword: "Please provide your old password" });
        }

        if (this.state.newPassword.length < minimumLength) {
            hasError = true;
            this.setState({
                errorNewPassword: `Passwords must contain at least ${minimumLength} characters`
            });
        }

        if (!hasError) {
            this.props.onChangePassword(this.state.oldPassword, this.state.newPassword);
        }
    };

    render() {
        if (!this.props.ready) {
            return <LoadingPlaceholder />;
        }

        const { oldPassword, newPassword, errorOldPassword, errorNewPassword } = collectErrors(this.props, this.state);

        return (
            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Password</h2>
                </BoxGroupHeader>
                <BoxGroupSection as="form" onSubmit={this.onSubmit}>
                    <InputGroup>
                        <InputLabel>Old Password</InputLabel>
                        <InputContainer>
                            <PasswordInput name="oldPassword" value={oldPassword} onChange={this.handleChange} />
                            <InputError>{errorOldPassword}</InputError>
                        </InputContainer>
                    </InputGroup>
                    <InputGroup>
                        <InputLabel>New password</InputLabel>
                        <InputContainer>
                            <PasswordInput name="newPassword" value={newPassword} onChange={this.handleChange} />
                            <InputError>{errorNewPassword}</InputError>
                        </InputContainer>
                    </InputGroup>
                    <ChangePasswordFooter>
                        <span>
                            Last changed <RelativeTime time={this.props.lastPasswordChange} />
                        </span>
                        <SaveButton altText="Change" />
                    </ChangePasswordFooter>
                </BoxGroupSection>
            </BoxGroup>
        );
    }
}

export const mapStateToProps = state => ({
    lastPasswordChange: state.account.last_password_change,
    minimumLength: get(state, "settings.data.minimum_password_length"),
    ready: !!state.settings.data,
    error: get(state, "errors.CHANGE_ACCOUNT_PASSWORD_ERROR", "")
});

export const mapDispatchToProps = dispatch => ({
    onChangePassword: (oldPassword, newPassword) => {
        dispatch(changePassword(oldPassword, newPassword));
    },

    onClearError: () => {
        dispatch(clearError("CHANGE_ACCOUNT_PASSWORD_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ChangePassword);
