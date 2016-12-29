/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PasswordChangeForm
 */

import React from "react";
import { Button, Alert } from "react-bootstrap";
import { Input } from "virtool/js/components/Base";

/**
 * A form used by user to change their password.
 */
export default class PasswordChangeForm extends React.Component {

    static propTypes = {
        password: React.PropTypes.string,
        confirm: React.PropTypes.string,
        warnings: React.PropTypes.array,

        reset: React.PropTypes.func,
        onChange: React.PropTypes.func
    };

    componentDidMount () {
        this.passwordNode.focus();
    }

    componentDidUpdate () {
        if (this.props.warnings.length > 0) {
            this.passwordNode.focus();
        }
    }

    /**
     * Triggered when the change password form is submitted. Sends a request to the server to change the user"s
     * password. Check
     *
     * @param event - the submit event from the form.
     */
    handleSubmit = (event) => {
        event.preventDefault();
        this.props.reset();
    };

    render () {
        
        let error;

        // Code for rendering warnings for failed passwords.
        if (this.props.warnings.length > 0) {
            const warningComponents = this.props.warnings.map((warning, index) => (
                <p key={index} className="text-danger">{warning}</p>
            ));

            error = <div>{warningComponents}</div>;
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <Alert bsStyle="info">Your password has expired. Please change it before continuing.</Alert>

                <Input
                    ref={this.passwordNode}
                    name="password"
                    type="password"
                    error={error}
                    errorPlacement="bottom"
                    label="New password"

                    value={this.props.password}
                    onChange={this.props.onChange}
                />

                <Input
                    type="password"
                    name="confirm"
                    label="Confirm"
                    value={this.props.confirm}
                    onChange={this.props.onChange}
                />

                <Button type="submit" bsStyle="primary" block>
                    Submit
                </Button>
            </form>
        );
    }
}
