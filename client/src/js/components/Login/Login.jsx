var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

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

                <PushButton type='submit' bsStyle='primary' block disabled={this.props.loginPending}>
                    <Icon name='key' pending={this.props.loginPending} /> Login
                </PushButton>
            </form>
        );
    }
});

module.exports = Login;