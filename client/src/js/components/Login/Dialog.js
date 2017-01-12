/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports LoginDialog
 */

import React from "react";
import { assign } from "lodash";
import { Alert } from "react-bootstrap";
import { Icon, Flex, FlexItem, Button, Input } from "virtool/js/components/Base";

import ChangePasswordForm from "./ChangePasswordForm";

const getInitialState = () => {
    return {
        username: "",
        password: "",
        loginPending: false,
        loginFailed: false,
        needsReset: false,
        wasReset: false,
        warnings: []
    };
};

export default class LoginDialog extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        onLogin: React.PropTypes.func,
        clearForcedLogout: React.PropTypes.func,
        forcedLogout: React.PropTypes.bool
    };

    componentDidMount () {
        this.usernameNode.focus();
    }

    componentDidUpdate (prevState) {
        if (!prevState.loginFailed && this.state.loginFailed || !prevState.wasReset && this.state.wasReset) {
            this.usernameNode.focus();
        }
    }

    handleSubmit = (event) => {
        event.preventDefault();
        this.setState({pending: true}, () => {
            dispatcher.send({
                interface: "users",
                method: "authorize_by_login",
                data: {
                    username: this.state.username,
                    password: this.state.password,
                    browser: dispatcher.browser
                }
            })
            .success(this.props.onLogin)
            .failure(this.onLoginFailure);
        });
    };

    onReset = () => {
        this.setState(assign(getInitialState(), {wasReset: true}));
    };

    onLoginFailure = (data) => {
        if (data.force_reset) {
            this.setState({needsReset: true});
        } else {
            this.setState(assign(getInitialState(), {loginFailed: true}));
        }
    };

    render () {

        const sharedProps = assign({
            login: this.login,
            reset: this.reset,
            onChange: this.handleChange
        }, this.state);

        const containerStyle = {
            width: "300px",
            paddingBottom: "200px"
        };

        const panelBodyStyle = {
            boxShadow: "rgba(0, 0, 0, 0.498039) 0px 5px 15px 0px"
        };

        let content;

        if (this.props.forcedLogout) {
            content = (
                <div>
                    <Alert bsStyle="danger">
                        <Flex>
                            <FlexItem>
                                <Icon name="warning" />
                            </FlexItem>
                            <FlexItem pad={5}>
                                Your session was stopped by an administrator.
                            </FlexItem>
                        </Flex>
                    </Alert>
                    <Button bsStyle="primary" onClick={this.props.clearForcedLogout} block>
                        <Icon name="checkmark" /> OK
                    </Button>
                </div>
            );
        }

        else if (this.state.needsReset) {
            content = (
                <ChangePasswordForm
                    {...sharedProps}
                    showExpiry={true}
                    requireOld={true}
                    onReset={this.onReset}
                    username={this.state.username}
                />
            );
        }

        else {
            const alertStyle = this.state.loginFailed ? null: {visibility: "hidden"};

            let resetMessage;

            if (this.state.wasReset) {
                resetMessage = (
                    <Alert bsStyle="info">
                        <Icon name="checkmark" /> Password was reset successfully
                    </Alert>
                );
            }

            content = (
                <form onSubmit={this.handleSubmit}>
                    {resetMessage}

                    <Input
                        ref={(input) => this.usernameNode = input}
                        type="text"
                        label="Username"
                        name="username"
                        value={this.state.username}
                        onChange={(event) => this.setState({username: event.target.value, loginFailed: false})}
                    />

                    <Input
                        type="password"
                        label="Password"
                        name="password"
                        value={this.state.password}
                        onChange={(event) => this.setState({password: event.target.value, loginFailed: false})}
                    />

                    <p className="text-danger" style={alertStyle}>
                        <Icon name="warning" /> Invalid username or password
                    </p>

                    <Button type="submit" bsStyle="primary" block disabled={this.state.loginPending}>
                        <Icon name="key" pending={this.state.loginPending} /> Login
                    </Button>
                </form>
            );
        }

        return (
            <div className="page-loading">
                <div style={containerStyle}>
                    <div className="panel panel-default">
                        <div className="panel-body" style={panelBodyStyle}>
                            {content}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
