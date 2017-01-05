/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports LoginForm
 */

import React from "react";
import { Icon, Input, Button } from "virtool/js/components/Base"

export default class LoginForm extends React.Component {

    static propTypes = {
        username: React.PropTypes.string,
        password: React.PropTypes.string,
        onChange: React.PropTypes.func,

        login: React.PropTypes.func,
        loginPending: React.PropTypes.bool,
        loginFailed: React.PropTypes.bool
    };

    componentDidMount () {
        this.usernameNode.focus();
    }

    componentDidUpdate (prevProps) {
        if (!prevProps.loginFailed && this.props.loginFailed) {
            this.usernameNode.focus();
        }
    }

    handleSubmit = (event) => {
        event.preventDefault();
        this.props.login();
    };

    render () {

        const alertStyle = this.props.loginFailed ? null: { color: "white" };

        return (
            <form onSubmit={this.handleSubmit}>
                <Input
                    ref="username"
                    type="text"
                    label="Username"
                    name="username"
                    value={this.props.username}
                    onChange={this.props.onChange}
                />

                <Input
                    type="password"
                    label="Password"
                    name="password"
                    value={this.props.password}
                    onChange={this.props.onChange}
                />

                <p className="text-danger" style={alertStyle}>
                    <Icon name="warning" /> Invalid username or password
                </p>

                <Button type="submit" bsStyle="primary" block disabled={this.props.loginPending}>
                    <Icon name="key" pending={this.props.loginPending} /> Login
                </Button>
            </form>
        );
    }
}
