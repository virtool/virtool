import { get } from "lodash-es";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { InputError, LoadingPlaceholder, Panel, RelativeTime, SaveButton } from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange } from "../../utils/utils";
import { changePassword } from "../actions";

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

        const hasError = errorOldPassword || errorNewPassword || errorConfirmPassword;

        return (
            <Row>
                <Col md={8} lg={6}>
                    <Panel bsStyle={hasError ? "danger" : "default"}>
                        <Panel.Heading>Password</Panel.Heading>
                        <Panel.Body>
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

                                <div style={{ marginTop: "20px" }}>
                                    <Row>
                                        <Col xs={12} md={6} className="text-muted">
                                            Last changed <RelativeTime time={this.props.lastPasswordChange} />
                                        </Col>
                                        <Col xs={12} md={6}>
                                            <SaveButton altText="Change" pullRight />
                                        </Col>
                                    </Row>
                                </div>
                            </form>
                        </Panel.Body>
                    </Panel>
                </Col>
            </Row>
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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ChangePassword);
