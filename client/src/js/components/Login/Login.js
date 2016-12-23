"use strict";

import React from "react";
import { Icon, Input, Button } from 'virtool/js/components/Base'

var Login = React.createClass({

    propTypes: {
        username: React.PropTypes.string,
        password: React.PropTypes.string,
        pending: React.PropTypes.bool,
        loginFailed: React.PropTypes.bool
    },

    componentDidMount: function () {
        this.refs.username.focus();
    },

    componentDidUpdate: function (prevProps) {
        if (!prevProps.loginFailed && this.props.loginFailed) this.focus();
    },

    handleSubmit: function (event) {
        event.preventDefault();
        this.props.login();
    },

    render: function () {

        var alertStyle = this.props.loginFailed ? null: {color: 'white'};

        return (
            <form onSubmit={this.handleSubmit}>
                <Input
                    ref='username'
                    type='text'
                    label='Username'
                    name='username'
                    value={this.props.username}
                    onChange={this.props.onChange}
                />

                <Input
                    type='password'
                    label='Password'
                    name='password'
                    value={this.props.password}
                    onChange={this.props.onChange}
                />

                <p className='text-danger' style={alertStyle}>
                    <Icon name='warning' /> Invalid username or password
                </p>

                <Button type='submit' bsStyle='primary' block disabled={this.props.loginPending}>
                    <Icon name='key' pending={this.props.loginPending} /> Login
                </Button>
            </form>
        );
    }
});

module.exports = Login;