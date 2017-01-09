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
import { Icon, Flex, FlexItem, Button } from "virtool/js/components/Base";

import LoginForm from "./Login";
import PasswordChangeForm from "./Change";

const getInitialState = () => {
    return {
        username: "",
        password: "",
        loginPending: false,
        loginFailed: false,

        needsReset: false,
        new: "",
        confirm: "",
        warnings: []
    };
}

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

    handleChange = (event) => {
        let state = {
            loginFailed: false,
            warnings: []
        };

        state[event.target.name] = event.target.value;

        this.setState(state);
    };

    login = () => {
        this.setState({pending: true}, () => {
            dispatcher.send({
                interface: "users",
                method: "authorize_by_login",
                data: {
                    username: this.state.username,
                    password: this.state.new || this.state.password,
                    browser: dispatcher.browser
                }
            })
            .success(this.props.onLogin)
            .failure(this.onLoginFailure);
        });
    };

    reset = () => {

        let newState = {
            warnings: []
        };

        if (this.state.new.length < 8) {
            newState.warnings.push("Passwords must be at least 8 characters long.");
            newState.new = "";
            newState.confirm = "";
        }

        if (this.state.new != this.state.confirm) {
            newState.warnings.push("Passwords do not match");
        }

        if (this.state.new.length >= 8 && this.state.new === this.state.confirm) {
            dispatcher.send({
                interface: "users",
                method: "change_password",
                data: {
                    _id: this.state.username,
                    old_password: this.state.password,
                    new_password: this.state.new
                }
            })
            .success(this.login)
            .failure(this.onResetFailure);
        }

        if (newState.warnings.length > 0) {
            this.setState(newState);
        }
    };

    onResetFailure = () => {
        this.setState({
            new: "",
            confirm: "",
            warnings: ["Server error. Contact administrator."]
        });
    };

    onLoginFailure = (data) => {
        if (data.force_reset) {
            this.setState({
                needsReset: true
            });
        } else {
            this.setState(assign(getInitialState(), { loginFailed: true }));
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
            content = <PasswordChangeForm {...sharedProps} />;
        }

        else {
            content = <LoginForm {...sharedProps} />
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
