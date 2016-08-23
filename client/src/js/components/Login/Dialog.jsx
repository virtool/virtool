var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');

var LoginForm = require('./Login.jsx');
var ChangeForm = require('./Change.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx')

var LoginDialog = React.createClass({

    getInitialState: function () {
        return {
            username: '',
            password: '',
            loginPending: false,
            loginFailed: false,

            needsReset: false,
            new: '',
            confirm: '',
            warnings: []
        };
    },

    handleChange: function (event) {
        var state = {
            loginFailed: false,
            warnings: []
        };

        state[event.target.name] = event.target.value;

        this.setState(state);
    },

    login: function () {
        this.setState({pending: true}, function () {

            dispatcher.send({
                collectionName: 'users',
                methodName: 'authorize_by_login',
                data: {
                    username: this.state.username,
                    password: this.state.new || this.state.password,
                    browser: dispatcher.browser
                }
            }).success(this.props.onLogin).failure(this.onLoginFailure);

        });
    },

    reset: function () {

        var newState = {
            warnings: []
        };

        if (this.state.new.length < 8) {
            newState.warnings.push('Passwords must be at least 8 characters long.');
            newState.new = '';
            newState.confirm = '';
        }

        if (this.state.new != this.state.confirm) {
            newState.warnings.push('Passwords do not match');
        }

        if (this.state.new.length >= 8 && this.state.new === this.state.confirm) {
            dispatcher.send({
                collectionName: "users",
                methodName: "change_password",
                data: {
                    _id: this.state.username,
                    old_password: this.state.password,
                    new_password: this.state.new
                }
            }).success(this.login).failure(this.onResetFailure);
        }

        if (newState.warnings.length > 0) this.setState(newState);
    },

    onResetFailure: function () {
        this.setState({
            new: '',
            confirm: '',
            warnings: ['Server error. Contact administrator.']
        });
    },

    onLoginFailure: function (data) {
        if (data.force_reset) {
            this.setState({
                needsReset: true
            });
        } else {
            this.replaceState(_.assign(this.getInitialState(), {loginFailed: true}));
        }
    },

    render: function () {

        var sharedProps = _.assign({
            login: this.login,
            reset: this.reset,
            onChange: this.handleChange
        }, this.state);

        var containerStyle = {
            width: '300px',
            paddingBottom: '200px'
        };

        var panelBodyStyle = {
            boxShadow: 'rgba(0, 0, 0, 0.498039) 0px 5px 15px 0px'
        };

        var content;

        if (this.props.forcedLogout) {
            content = (
                <div>
                    <Alert bsStyle='danger'>
                        <Flex>
                            <Flex.Item>
                                <Icon name='warning' />
                            </Flex.Item>
                            <Flex.Item pad={5}>
                                Your session was stopped by an administrator.
                            </Flex.Item>
                        </Flex>
                    </Alert>
                    <PushButton bsStyle='primary' onClick={this.props.clearForcedLogout} block>
                        <Icon name='checkmark' /> OK
                    </PushButton>
                </div>
            );
        }

        else if (this.state.needsReset) {
            content = <ChangeForm {...sharedProps} />;
        }

        else {
            content = <LoginForm {...sharedProps} />
        }

        return (
            <div className='page-loading'>
                <div style={containerStyle}>
                    <div className='panel panel-default'>
                        <div className='panel-body' style={panelBodyStyle}>
                            {content}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

module.exports = LoginDialog;