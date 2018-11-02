import React from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { changePassword } from "../actions";
import { clearError } from "../../errors/actions";
import { SaveButton, InputError, RelativeTime } from "../../base";
import { getTargetChange } from "../../utils/utils";

const getInitialState = props => ({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    errorOldPassword: "",
    errorNewPassword: "",
    errorConfirmPassword: "",
    error: props.error
});

export class ChangePassword extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (!prevState.error && nextProps.error) {
            if (nextProps.error.status === 400) {
                return {
                    errorOldPassword: nextProps.error.message,
                    error: nextProps.error
                };
            }
        }

        return null;
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
            this.props.onClearError("CHANGE_ACCOUNT_PASSWORD_ERROR");
        }
    };

    onSubmit = e => {
        e.preventDefault();

        let hasError = false;
        const minLength = this.props.settings.minimum_password_length;

        if (!this.state.oldPassword.length) {
            hasError = true;
            this.setState({ errorOldPassword: "Please provide your old password" });
        }

        if (0 < this.state.oldPassword.length && this.state.oldPassword.length < minLength) {
            hasError = true;
            this.setState({
                errorOldPassword: `Passwords must contain at least ${minLength} characters`
            });
        }

        if (this.state.newPassword.length < minLength) {
            hasError = true;
            this.setState({
                errorNewPassword: `Passwords must contain at least ${minLength} characters`
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
        if (!this.props.settings) {
            return <div />;
        }

        const hasError = this.state.errorOldPassword || this.state.errorNewPassword || this.state.ConfirmPassword;

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
                                    value={this.state.oldPassword}
                                    onChange={this.handleChange}
                                    error={this.state.errorOldPassword}
                                />
                                <InputError
                                    label="New password"
                                    type="password"
                                    name="newPassword"
                                    value={this.state.newPassword}
                                    onChange={this.handleChange}
                                    error={this.state.errorNewPassword}
                                />
                                <InputError
                                    label="Confirm New Password"
                                    type="password"
                                    name="confirmPassword"
                                    value={this.state.confirmPassword}
                                    onChange={this.handleChange}
                                    error={this.state.errorConfirmPassword}
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

const mapStateToProps = state => ({
    lastPasswordChange: state.account.last_password_change,
    settings: state.settings.data,
    error: get(state, "errors.CHANGE_ACCOUNT_PASSWORD_ERROR", "")
});

const mapDispatchToProps = dispatch => ({
    onChangePassword: (oldPassword, newPassword) => {
        dispatch(changePassword(oldPassword, newPassword));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ChangePassword);
