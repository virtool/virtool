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

'use strict';

var React = require('react');
var Cookie = require('react-cookie');
var Progress = require('rc-progress').Circle;
var ProgressBar = require('react-bootstrap/lib/ProgressBar');

var Dispatcher = require('virtool/js/dispatcher/main.js');
var Utils = require('virtool/js/Utils');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Setup = require('virtool/js/components/Start/Setup/Setup.jsx');
var Main = require('virtool/js/components/Main/Main.jsx');
var LoginDialog = require('./Login/Dialog.jsx');

var Start = React.createClass({

    getInitialState: function () {
        return {
            checkedSetup: false,
            needsSetup: false,

            checkedToken: false,
            needsLogin: false,

            synced: false,
            syncProgress: 0,

            forcedLogout: false
        };
    },

    componentDidMount: function () {
        this.checkSetup();
    },

    componentDidUpdate: function () {

    },

    checkSetup: function () {
        Utils.postJSON('/', {operation: 'check_ready'}, function (data) {
            this.setState({
                checkedSetup: true,
                needsSetup: !data.serverReady
            }, this.establishConnection);
        }.bind(this));
    },

    establishConnection: function () {
        if (!this.state.needsSetup) {
            window.dispatcher = new Dispatcher(this.onDispatcherReady);

            dispatcher.on('synced', function () {
                this.setState({
                    synced: true,
                    syncProgress: 1
                });
            }.bind(this));

            dispatcher.on('syncing', function (data) {
                this.setState({syncProgress: data})
            }.bind(this));
        }
    },

    clearForcedLogout: function () {
        this.setState({
            forcedLogout: false
        });
    },

    handleLogin: function (user) {
        dispatcher.user.authorize(user);

        this.setState({
            needsLogin: false
        });

        dispatcher.user.on('logout', this.onLogout);
    },

    onDispatcherReady: function () {
        var token = Cookie.load('token');

        if (token) {
            dispatcher.send({
                collectionName: 'users',
                methodName: 'authorize_by_token',
                data: {
                    token: token,
                    browser: dispatcher.browser
                }
            }, this.onCheckTokenSuccess, this.onCheckTokenFailure);
        } else {
            this.onCheckTokenFailure();
        }
    },

    onCheckTokenSuccess: function (user) {
        dispatcher.user.authorize(user);

        this.setState({
            checkedToken: true,
            needsLogin: false
        });

        dispatcher.user.on('logout', this.onLogout);
    },

    onCheckTokenFailure: function () {
        this.setState({
            checkedToken: true,
            needsLogin: true
        });
    },

    onLogout: function (data) {
        var newState = _.assign(this.getInitialState(), {
            checkedSetup: true,
            checkedToken: true,
            needsLogin: true,
            forcedLogout: !data.logout
        });

        dispatcher.runningOperationCount = 0;
        dispatcher.syncOperationCount = 0;

        this.setState(newState);
    },

    render: function () {

        var logo = <Icon name='vtlogo' className='vtlogo' style={{paddingBottom: '5px'}} />;

        if (!this.state.checkedSetup || (this.state.checkedSetup && !this.state.needsSetup && !this.state.checkedToken)) {
            return (
                <div className='page-loading'>
                    <p className='text-center'>
                        {logo}
                    </p>
                </div>
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
                <div className='page-loading'>
                    <div className='text-center'>
                        {logo}
                        <ProgressBar
                            now={(this.state.syncProgress > 0.08 ? this.state.syncProgress: 0.02) * 100}
                            style={{width: '300px', marginRight: '0px'}}
                            active
                        />
                    </div>
                </div>
            );
        }

        return <Main />;
    }

});

module.exports = Start;