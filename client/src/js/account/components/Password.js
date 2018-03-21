import React from "react";
import { get, upperFirst } from "lodash-es";
import { connect } from "react-redux";
import { Col, Panel, Row } from "react-bootstrap";

import { changePassword } from "../actions";
import { clearError } from "../../errors/actions";
import { Button, InputError, RelativeTime } from "../../base";

const getInitialState = () => ({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    errorOldPassword: "",
    errorNewPassword: "",
    errorConfirmPassword: ""
});

class ChangePassword extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentWillReceiveProps (nextProps) {
        if (!this.props.error && nextProps.error) {
            const minLength = nextProps.settings.minimum_password_length;

            if (nextProps.error.status === 400) {
                this.setState({
                    errorOldPassword: nextProps.error.message
                });
            } else {
                this.setState({
                    errorOldPassword: `Passwords must contain at least ${minLength} characters`
                });
            }
        }

        // Clears form on successful password change
        if (nextProps.lastPasswordChange !== this.props.lastPasswordChange) {
            this.setState(getInitialState());
        }
    }

    handleChange = (e) => {
        const errorType = `error${upperFirst(e.target.name)}`;
        this.setState({[e.target.name]: e.target.value, [errorType]: ""});

        if (this.props.error) {
            this.props.onClearError("CHANGE_ACCOUNT_PASSWORD_ERROR");
        }
    };

    onSubmit = (e) => {
        e.preventDefault();

        let error = "";
        const minLength = this.props.settings.minimum_password_length;

        if (!this.state.oldPassword.length) {
            error = "Please provide your old password";
            this.setState({ errorOldPassword: error });
        }

        if (this.state.newPassword.length < minLength) {
            error = `Passwords must contain at least ${minLength} characters`;
            this.setState({ errorNewPassword: error });
        }

        if (this.state.confirmPassword !== this.state.newPassword) {
            error = "New passwords do not match";
            this.setState({ errorConfirmPassword: error });
        }

        if (!error) {
            this.props.onChangePassword(this.state.oldPassword, this.state.newPassword, this.state.confirmPassword);
        }
    };

    render () {

        if (!this.props.settings) {
            return <div />;
        }

        const formStyle = this.state.errorOldPassword || this.state.errorNewPassword || this.state.errorConfirmPassword
            ? "panel-danger" : "panel-default";

        return (
            <Panel className={formStyle} header="Password">
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

                    <div style={{marginTop: "20px"}}>
                        <Row>
                            <Col xs={12} md={6} className="text-muted">
                                Last changed <RelativeTime time={this.props.lastPasswordChange} />
                            </Col>
                            <Col xs={12} md={6}>
                                <Button type="submit" bsStyle="primary" icon="floppy" pullRight>
                                    Change
                                </Button>
                            </Col>
                        </Row>
                    </div>
                </form>
            </Panel>
        );
    }
}

const mapStateToProps = (state) => ({
    lastPasswordChange: state.account.last_password_change,
    settings: state.settings.data,
    error: get(state, "errors.CHANGE_ACCOUNT_PASSWORD_ERROR", "")
});

const mapDispatchToProps = (dispatch) => ({

    onChangePassword: (oldPassword, newPassword) => {
        dispatch(changePassword(oldPassword, newPassword));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ChangePassword);
