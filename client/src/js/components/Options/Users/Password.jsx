/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AdminChangePassword
 */

'use strict';

var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');

var Alert = require('react-bootstrap/lib/Alert');
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/Input');
var Table = require('react-bootstrap/lib/Table');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

/**
 * The password change form subcomponent of the component exported by the module.
 */
var Change = React.createClass({

    mixins: [LinkedStateMixin],

    getInitialState: function () {
        return {
            new: '',
            confirm: '',
            failed: false,
            pendingChange: false
        }
    },

    /**
     * Called when the password is submitted. Sends the new password data to the server.
     *
     * @param event - the submit event, used purely to prevent the default submit action
     */
    submit: function (event) {
        event.preventDefault();

        // The new and confirm fields must contain the same password.
        var match = this.state.new === this.state.confirm;

        // The password must have a minimum length (current defaulted to 4).
        var long = this.state.new.length >= 4;

        if (match && long) {
            this.setState({pendingChange: true} , function () {
                dispatcher.db.users.request('set_password', {
                    // The username and new password to assign for it.
                    _id: this.props._id,
                    new_password: this.state.new
                }, this.clear);
            });
        } else {
            this.setState({failed: true});
        }
    },

    /**
     * Called when the clear form button is clicked. Resets the state of the form so there is no change pending and the
     * inputs are empty.
     */
    clear: function () {
        this.replaceState(this.getInitialState());
    },

    render: function () {

        // Check that the passwords pass the following tests.
        var match = this.state.new === this.state.confirm;
        var long = this.state.new.length >= 4;

        var alert;

        // Show and alert with warnings if the password failed the prerequest checks.
        if (!(match && long) && this.state.failed) {
            alert = (
                <Alert bsStyle='danger' className=''>
                    {long ? null: <li>passwords are not at least 4 characters long</li>}
                    {match ? null: <li>passwords don't match</li>}
                </Alert>
            );
        }

        // Boolean to set whether the submit button is disabled or not.
        var submitDisabled = (!(match && long) && this.state.failed) || this.state.pendingChange;

        // Show a spinner while a password change is pending.
        var saveIconClass = this.state.pendingChange ? 'i-spinner spinning': 'i-floppy';

        return (
            <div>
                <p>
                    <em>Last changed </em>
                    <RelativeTime time={this.props.last_password_change} em={true} />
                </p>
                <form onSubmit={this.submit}>
                    <Flex>
                        <Flex.Item grow={1}>
                            <Input
                                type='password'
                                placeholder='New Password'
                                valueLink={this.linkState('new')}
                                disabled={this.state.pendingChange}
                            />
                        </Flex.Item>

                        <Flex.Item grow={1} pad>
                            <Input
                                type='password'
                                placeholder='Confirm Password'
                                valueLink={this.linkState('confirm')}
                                disabled={this.state.pendingChange}
                            />
                        </Flex.Item>

                        <Flex.Item pad>
                            <PushButton onClick={this.clear} disabled={this.state.pendingChange}>
                                Clear
                            </PushButton>
                        </Flex.Item>

                        <Flex.Item pad>
                            <PushButton type='submit' bsStyle='primary' disabled={submitDisabled}>
                                <Icon name='floppy' pending={this.state.pendingChange} /> Save
                            </PushButton>
                        </Flex.Item>
                    </Flex>
                </form>
                {alert}
            </div>
        );
    }
});

/**
 * An subcomponent of the password change form that allows the force reset status of the user to be toggled. Consists only of
 * a label checkbox.
 */
var Reset = React.createClass({

    toggle: function () {
        dispatcher.db.users.request('set_force_reset', {
            _id: this.props._id,
            force_reset: !this.props.force_reset
        });
    },

    render: function () {
        return (
            <div className='panel-section'>
                <Checkbox checked={this.props.force_reset} onClick={this.toggle} />
                <span> Force user to reset password on next login.</span>
            </div>
        );
    }

});

/**
 * A parent component to wrap the password change form and reset checkbox with a headed panel.
 */
var AdminChangePassword = React.createClass({

    render: function () {

        return (
            <div>
                <h5><Icon name='lock' /> <strong>Password</strong></h5>

                <Panel>
                    <Change {...this.props} />
                    <Reset {...this.props} />
                </Panel>
            </div>
        );
    }
});

module.exports = AdminChangePassword;