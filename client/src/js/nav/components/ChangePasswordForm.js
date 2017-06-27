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
import { Input, Button } from "virtool/js/components/Base";

const getInitialState = () => {
    return {
        oldPassword: "",
        password: "",
        confirm: "",
        tooShort: true,
        noMatch: true,
        submitted: false,
        failure: false
    };
};

/**
 * A form used by user to change their password.
 */
export default class PasswordChangeForm extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        // Function called when the user's password is successfully reset.
        onReset: React.PropTypes.func,

        // Should the old password be required in order for a new one to be set?
        requireOld: React.PropTypes.bool,

        // Toggles the visibility of a notice telling the user their password expired.
        showExpiry: React.PropTypes.bool,

        // An element to position above the reset form.
        header: React.PropTypes.element,

        // Classes to apply to the form body and the footer that contains the submit button.
        bodyClass: React.PropTypes.string,
        footerClass: React.PropTypes.string,

        // A username to override the one stored in dispatcher.user.
        username: React.PropTypes.string
    };

    componentDidMount () {
        (this.props.requireOld ? this.oldPasswordNode: this.passwordNode).focus();
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

            dispatcher.send({
                interface: "users",
                method: "change_password",
                data: data
            }).success(() => {
                this.setState(getInitialState(), this.props.onReset);
            }).failure(() => {
                // The old and new passwords do not match. Can only be determined on the server.
                this.setState({
                    old: "",
                    password: "",
                    confirm: "",
                    failure: true
                });
            });
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
                {this.props.header}

                <div className={this.props.bodyClass}>
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

                <div className={this.props.footerClass}>
                    <Button icon="floppy" bsStyle="primary" type="submit" pullRight>
                        Save
                    </Button>
                </div>
            </form>
        );
    }
}
