/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ChangePassword
 */

'use strict';

import React from "react";
import {cloneDeep, assign} from "lodash";
import {Modal, ButtonToolbar} from "react-bootstrap";

import { Icon, Input, Button } from 'virtool/js/components/Base';


var ChangePassword = React.createClass({

    propTypes: {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            old: '',
            new: '',
            confirm: '',
            failure: false,
            tooShort: true,
            noMatch: true,
            submitted: false
        };
    },

    componentDidUpdate: function (prevProps, prevState) {
        // Focus on the first Input component if that form is submitted but fails and the fields need to be re-entered.
        var submitted = !prevState.submitted && this.state.submitted;

        if (submitted && (this.state.failure || this.state.noMatch || this.state.tooShort)) {
            this.refs.old.getInputDOMNode().focus();
        }
    },



    /**
     * Handles changes in input fields. Sets state based on the new values in the field.
     *
     * @param event - the input 'change' event.
     */
    handleChange: function (event) {
        var newState = _.cloneDeep(this.state);

        var name = event.target.name;

        newState[name] = event.target.value;

        if (name === 'old') newState.failure = false;

        newState.noMatch = newState.confirm !== newState.new;
        newState.tooShort = newState.confirm.length < 4 || newState.new.length < 4;

        this.setState(newState);
    },

    /**
     * Send a change password request to the server. Called when the form fires a 'submit' event.
     *
     * @param event {object} - the submit event.
     */
    handleSubmit: function (event) {
        event.preventDefault();

        var newState = _.cloneDeep(this.state);

        // Only send the request if the new passwords match and the password is at least four characters in length.
        if (!this.state.tooShort && !this.state.noMatch) {
            dispatcher.db.users.request('change_password', {
                _id: dispatcher.user.name,
                old_password: this.state.old,
                new_password: this.state.new
            }).success(function () {
                this.replaceState(this.getInitialState());
                this.props.onHide();
            }, this).failure(function () {
                this.setState({
                    old: '',
                    new: '',
                    confirm: '',
                    failure: true
                });
            }, this);
        } else {
            // Clear the fields if the new passwords are inadequate.
            _.assign(newState, {old: '', new: '', confirm: ''});
        }

        // Set state to show that the user attempted to submit the form.
        newState.submitted = true;

        this.setState(newState);
    },

    render: function () {
        // Variables used to color fields and show text to convey password failure warnings.
        var warnings = [];
        var newStyle;
        var oldStyle;

        if (this.state.submitted) {
            if (this.state.noMatch) {
                warnings.push('New passwords must match');
                newStyle = 'error';
            }

            if (this.state.failure) {
                warnings.push('Old password is incorrect');
                oldStyle = 'error';
            }

            if (this.state.tooShort) {
                warnings.push("New password must be at least four characters long");
                newStyle = "error";
            }
        }

        // Lines containing password failure messages.
        var warningComponents = warnings.map(function (warning, index) {
            return (
                <p key={"warning-" + index} className="text-danger">
                    <Icon name="warning" /> {warning}
                </p>
            )
        });

        // Props shared by all Input components.
        var inputProps = {
            type: "password",
            onChange: this.handleChange
        };

        return (
            <Modal bsSize='small' show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Change Password
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
                            ref="old"
                            name="old"
                            label="Old Password"
                            value={this.state.old}
                            bsStyle={oldStyle}
                            {...inputProps}
                        />
                        <Input
                            name="new"
                            label="New Password"
                            value={this.state.new}
                            bsStyle={newStyle}
                            {...inputProps}
                        />
                        <Input
                            name="confirm"
                            label="Confirm"
                            value={this.state.confirm}
                            bsStyle={newStyle}
                            {...inputProps}
                        />

                        {warningComponents.length > 0 ? <div>{warningComponents}</div>: null}
                    </Modal.Body>

                    <Modal.Footer>
                        <ButtonToolbar className="pull-right">
                            <Button onClick={this.props.onHide}>
                                <Icon name="cancel" /> Cancel
                            </Button>
                            <Button bsStyle="primary" type="submit">
                                <Icon name="floppy" /> Save
                            </Button>
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
});

module.exports = ChangePassword;