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

import React from "react";
import { Alert, Panel } from 'react-bootstrap';
import { Flex, FlexItem, Icon, Input, Checkbox, Button, RelativeTime } from "virtool/js/components/Base";

/**
 * The password change form subcomponent of the component exported by the module.
 */
var Change = React.createClass({

    getInitialState: function () {
        return {
            new: '',
            confirm: '',
            failed: false,
            pendingChange: false
        }
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
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
                }).success(function () {
                    this.replaceState(this.getInitialState());
                }, this);
            });
        } else {
            this.setState({failed: true});
        }
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

        return (
            <div>
                <p>
                    <em>Last changed </em>
                    <RelativeTime time={this.props.last_password_change} em={true} />
                </p>
                <form onSubmit={this.submit}>
                    <Flex>
                        <FlexItem grow={1}>
                            <Input
                                type='password'
                                name="new"
                                placeholder='New Password'
                                value={this.state.new}
                                onChange={this.handleChange}
                                disabled={this.state.pendingChange}
                            />
                        </FlexItem>

                        <FlexItem grow={1} pad>
                            <Input
                                type='password'
                                name="confirm"
                                placeholder='Confirm Password'
                                value={this.state.confirm}
                                onChange={this.handleChange}
                                disabled={this.state.pendingChange}
                            />
                        </FlexItem>

                        <FlexItem pad>
                            <Button onClick={this.clear} disabled={this.state.pendingChange}>
                                Clear
                            </Button>
                        </FlexItem>

                        <FlexItem pad>
                            <Button type='submit' bsStyle='primary' disabled={submitDisabled}>
                                <Icon name='floppy' pending={this.state.pendingChange} /> Save
                            </Button>
                        </FlexItem>
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