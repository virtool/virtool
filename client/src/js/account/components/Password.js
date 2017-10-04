/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ChangePassword
 */

import React from "react";
import { connect } from "react-redux";
import { clone, assign } from "lodash";
import { Row, Col, Panel } from "react-bootstrap";

import { Button, Input, RelativeTime } from "../../base";

const getInitialState = () => {
    return {
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
        tooShort: true,
        noMatch: true,
        submitted: false,
        failure: false
    };
};

/**
 * A form used by user to change their password.
 */
class ChangePassword extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidUpdate (prevProps, prevState) {
        // Focus on the first Input component if that form is submitted but fails and the fields need to be re-entered.
        const submitted = !prevState.submitted && this.state.submitted;

        if (submitted && (this.state.failure || this.state.noMatch || this.state.tooShort)) {
            this.passwordNode.focus();
        }
    }

    handleChange = (event) => {

        let newState = clone(this.state);

        newState[event.target.name] = event.target.value;

        if (event.target.name === "old") {
            newState.failure = false;
        }

        this.setState(assign(newState, {
            noMatch: newState.confirm !== newState.password,
            tooShort: newState.confirm.length < 4 || newState.password.length < 4
        }));
    };

    handleSubmit = (event) => {
        event.preventDefault();

        // Only send the request if the new passwords match and the password is at least four characters in length.
        if (!this.state.tooShort && !this.state.noMatch) {
            const data = {
                _id: this.props.username || dispatcher.user.name,
                old_password: this.state.old,
                new_password: this.state.password
            };
        }

        // Set state to show that the user attempted to submit the form.
        this.setState({submitted: true});
    };

    render () {

        let oldError;
        let passwordError;
        let confirmError;

        if (this.state.submitted) {
            passwordError = this.state.tooShort ? "New password must be at least four characters long": null;
            confirmError = this.state.noMatch ? "Passwords don't match": null;
            oldError = this.state.failure ? "Old password is incorrect" : null;
        }

        return (
            <Panel header="Password">
                <form onSubmit={this.handleSubmit}>
                    <Input
                        name="old"
                        label="Old Password"
                        error={oldError}
                        errorPlacement="bottom"
                        value={this.state.old}
                    />
                    <Input
                        name="password"
                        label="New password"
                        error={passwordError}
                        errorPlacement="bottom"
                        value={this.state.password}
                    />
                    <Input
                        name="confirm"
                        label="Confirm New Password"
                        error={confirmError}
                        errorPlacement="bottom"
                        value={this.state.confirm}
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

const mapStateToProps = (state) => {
    return {
        lastPasswordChange: state.account.last_password_change
    };
};

const Container = connect(mapStateToProps)(ChangePassword);

export default Container;
