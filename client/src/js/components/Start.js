/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Start
 */

import React from "react";
import Cookie from "js-cookie";

import { assign } from "lodash-es";
import { postJSON } from "virtool/js/utils";

import { Flex, FlexItem, ProgressLogo } from "virtool/js/components/Base";

import  Dispatcher from "virtool/js/dispatcher/main";
import Setup from "./Setup/Setup";
import Main from "virtool/js/components/Main";
import LoginDialog from "./Login/Dialog";

const getInitialState = () => ({
    checkedSetup: false,
    needsSetup: false,

    checkedToken: false,
    needsLogin: false,

    synced: false,
    syncProgress: 0,

    forcedLogout: false
});

export default class Start extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidMount () {
        this.checkSetup();
    }

    checkSetup = () => {
        postJSON("/", {operation: "check_ready"}, (data) => {
            this.setState({
                checkedSetup: true,
                needsSetup: !data.serverReady
            }, this.establishConnection);
        });
    };

    establishConnection = () => {
        if (!this.state.needsSetup) {

            window.dispatcher = new Dispatcher(this.onDispatcherReady);

            dispatcher.on("synced", () => {
                this.setState({
                    synced: true,
                    syncProgress: 1
                });
            });

            dispatcher.on("syncing", (data) => {
                this.setState({syncProgress: data});
            });
        } else {
            window.history.replaceState({}, document.title, "/");
        }
    };

    clearForcedLogout = () => this.setState({forcedLogout: false});

    handleLogin = (user) => {
        dispatcher.user.authorize(user);

        this.setState({
            needsLogin: false
        });

        dispatcher.user.on("logout", this.onLogout);
    };

    onDispatcherReady = () => {
        const token = Cookie.get("token");

        if (token) {
            dispatcher.send({
                interface: "users",
                method: "authorize_by_token",
                data: {
                    token: token,
                    browser: dispatcher.browser
                }
            })
            .failure(this.onCheckTokenFailure)
            .success((user) => {
                dispatcher.user.authorize(user);

                this.setState({
                    checkedToken: true,
                    needsLogin: false
                });

                dispatcher.user.on("logout", this.onLogout);
            });

        } else {
            this.onCheckTokenFailure();
        }
    };

    onCheckTokenFailure = () => {
        this.setState({
            checkedToken: true,
            needsLogin: true
        });
    };

    onLogout = (data) => {
        dispatcher.runningOperationCount = 0;
        dispatcher.syncOperationCount = 0;

        this.setState(assign(getInitialState(), {
            checkedSetup: true,
            checkedToken: true,
            needsLogin: true,
            forcedLogout: !data.logout
        }));
    };

    render () {

        if (!this.state.checkedSetup ||
            (this.state.checkedSetup && !this.state.needsSetup && !this.state.checkedToken)
        ) {
            return (
                <Flex alignContent="center" justifyContent="center" className="page-loading">
                    <FlexItem grow={0} shrink={0} alignSelf="center">
                        <ProgressLogo value={0} />
                    </FlexItem>
                </Flex>
            );
        }

        if (this.state.checkedSetup && this.state.needsSetup) {
            return <Setup />;
        }

        if (this.state.checkedToken && this.state.needsLogin) {
            return (
                <LoginDialog
                    onLogin={this.handleLogin}
                    forcedLogout={this.state.forcedLogout}
                    clearForcedLogout={this.clearForcedLogout}
                />
            );
        }

        if (!this.state.synced) {
            return (
                <Flex alignContent="center" justifyContent="center" className="page-loading">
                    <FlexItem grow={0} shrink={0} alignSelf="center">
                        <ProgressLogo value={this.state.syncProgress} />
                    </FlexItem>
                </Flex>
            );
        }

        return <Main />;
    }

}
