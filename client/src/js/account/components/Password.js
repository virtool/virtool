import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    InputError,
    LoadingPlaceholder,
    RelativeTime,
    SaveButton
} from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange } from "../../utils/utils";
import { changePassword } from "../actions";

const FormButton = styled(BoxGroupSection)`
    height: 310px;
`;

const DateButton = styled.div`
    margin-top: 17px;
    display: flex;
    justify-content: space-between;
    align-items: start;
`;

const Date = styled.div`
    color: ${props => props.theme.color.greyDark};
`;

const getInitialState = props => ({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    errorOldPassword: "",
    errorNewPassword: "",
    errorConfirmPassword: "",
    error: props.error
});

const deriveState = (props, state) => {
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

    componentDidUpdate(prevProps) {
        // Clears form on successful password change
        if (this.props.lastPasswordChange !== prevProps.lastPasswordChange) {
            return getInitialState(this.props);
        }
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

        if (this.state.confirmPassword !== this.state.newPassword) {
            hasError = true;
            this.setState({ errorConfirmPassword: "New passwords do not match" });
        }

        if (!hasError) {
            this.props.onChangePassword(this.state.oldPassword, this.state.newPassword);
        }
    };

    render() {
        if (!this.props.ready) {
            return <LoadingPlaceholder />;
        }

        const {
            oldPassword,
            newPassword,
            confirmPassword,
            errorOldPassword,
            errorNewPassword,
            errorConfirmPassword
        } = deriveState(this.props, this.state);

        return (
            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Password</h2>
                </BoxGroupHeader>
                <FormButton>
                    <form onSubmit={this.onSubmit}>
                        <InputError
                            label="Old Password"
                            type="password"
                            name="oldPassword"
                            value={oldPassword}
                            onChange={this.handleChange}
                            error={errorOldPassword}
                        />
                        <InputError
                            label="New password"
                            type="password"
                            name="newPassword"
                            value={newPassword}
                            onChange={this.handleChange}
                            error={errorNewPassword}
                        />
                        <InputError
                            label="Confirm New Password"
                            type="password"
                            name="confirmPassword"
                            value={confirmPassword}
                            onChange={this.handleChange}
                            error={errorConfirmPassword}
                        />
                        <DateButton>
                            <Date>
                                Last changed <RelativeTime time={this.props.lastPasswordChange} />
                            </Date>
                            <SaveButton altText="Change" pullRight />
                        </DateButton>
                    </form>
                </FormButton>
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
