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
import { clone, assign } from "lodash";
import { Alert } from "react-bootstrap";
import { Input } from "virtool/js/components/Base";

const getInitialState = () => {
    return {
        old: "",
        password: "",
        confirm: "",
        tooShort: true,
        noMatch: true,
        submitted: false,
        failure: false
    };
}

/**
 * A form used by user to change their password.
 */
export default class PasswordChangeForm extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        reset: React.PropTypes.func,
        onHide: React.PropTypes.func,
        showExpiry: React.PropTypes.bool,
        requireOld: React.PropTypes.bool,
        footer: React.PropTypes.element,
        containerClass: React.PropTypes.string
    };

    componentDidMount () {
        if (this.props.requireOld) {
            this.oldPasswordNode.focus();
        } else {
            this.passwordNode.focus();
        }
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

        assign(newState, {
            noMatch: newState.confirm !== newState.password,
            tooShort: newState.confirm.length < 4 || newState.password.length < 4
        });

        this.setState(newState);
    };

    handleSubmit = (event) => {
        event.preventDefault();

        let newState = clone(this.state);

        // Only send the request if the new passwords match and the password is at least four characters in length.
        if (!this.state.tooShort && !this.state.noMatch) {
            dispatcher.db.users.request("change_password", {
                _id: dispatcher.user.name,
                old_password: this.state.old,
                new_password: this.state.password
            }).success(() => {
                this.setState(getInitialState());
                this.props.onHide();
            }).failure(() => {
                this.setState({
                    old: "",
                    password: "",
                    confirm: "",
                    failure: true
                });
            });
        }

        // Set state to show that the user attempted to submit the form.
        newState.submitted = true;

        this.setState(newState);
    };

    render () {

        let oldError;
        let passwordError;
        let confirmError;

        if (this.state.submitted) {
            passwordError = this.state.tooShort ? "New password must be at least four characters long": null;
            confirmError = this.state.noMatch ? "Passwords don't match": null;

            if (this.props.requireOld) {
                oldError = this.state.failure ? "Old password is incorrect" : null;
            }
        }

        const inputProps = {
            type: "password",
            onChange: this.handleChange
        };

        let oldField;

        if (this.props.requireOld) {
            oldField = (
                <Input
                    ref={(node) => this.oldPasswordNode = node}
                    name="old"
                    label="Old Password"
                    error={oldError}
                    errorPlacement="bottom"
                    value={this.state.old}
                    {...inputProps}
                />
            );
        }

        let expiry;

        if (this.props.showExpiry) {
            expiry = <Alert bsStyle="info">Your password has expired. Please change it before continuing.</Alert>;
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className={this.props.containerClass}>
                    {expiry}
                    {oldField}

                    <Input
                        ref={(node) => this.passwordNode = node}
                        name="password"
                        label="New password"
                        error={passwordError}
                        errorPlacement="bottom"
                        value={this.state.password}
                        {...inputProps}
                    />

                    <Input
                        name="confirm"
                        label="Confirm"
                        error={confirmError}
                        errorPlacement="bottom"
                        value={this.state.confirm}
                        {...inputProps}
                    />
                </div>

                {this.props.footer}
            </form>
        );
    }
}
