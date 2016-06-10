/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PasswordChangeForm
 */

'use strict';

var React = require('react');
var Input = require('react-bootstrap/lib/Input');
var Button = require('react-bootstrap/lib/Button');
var Alert = require('react-bootstrap/lib/Alert');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var InputError = require('virtool/js/components/Base/InputError.jsx');

/**
 * A form used by user to change their password.
 */
var PasswordChangeForm = React.createClass({

    propTypes: {
        new: React.PropTypes.string,
        confirm: React.PropTypes.string,
        warnings: React.PropTypes.array
    },

    componentDidMount: function () {
        this.focus();
    },

    componentDidUpdate: function () {
        if (this.props.warnings.length > 0) this.focus();
    },

    focus: function () {
        this.refs.new.getInputDOMNode().focus();
    },

    /**
     * Triggered when the change password form is submitted. Sends a request to the server to change the user's
     * password. Check
     *
     * @param event - the submit event from the form.
     */
    handleSubmit: function (event) {
        event.preventDefault();
        this.props.reset();
    },

    render: function () {
        
        var error;

        // Code for rendering warnings for failed passwords.
        if (this.props.warnings.length > 0) {
            var warningComponents = this.props.warnings.map(function (warning, index) {
                return <p key={index} className='text-danger'>{warning}</p>;
            });

            error = (
                <div>
                    {warningComponents}
                </div>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <Alert bsStyle='info'>Your password has expired. Please change it before continuing.</Alert>

                <InputError
                    ref='new'
                    name='new'
                    error={error}
                    placement='bottom'
                    type='password'
                    label='New password'
                    value={this.props.new}
                    onChange={this.props.onChange}
                />

                <Input
                    type='password'
                    name='confirm'
                    label='Confirm'
                    value={this.props.confirm}
                    onChange={this.props.onChange}
                />

                <Button type='submit' bsStyle='primary' block>
                    Submit
                </Button>
            </form>
        );
    }
});

module.exports = PasswordChangeForm;