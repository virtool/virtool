/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports InputSave
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var Button = require('react-bootstrap/lib/Button');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');

var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A single input form component with a submit addon button that behaves well for updated VT settings.
 */
var InputSave = React.createClass({

    propTypes: {
        name: React.PropTypes.string,

        // The function to call with the newValue when the form is submitted.
        onSave: React.PropTypes.func.isRequired,

        // The label to apply to the Input component.
        label: React.PropTypes.string,

        // The type attribute to apply to the Input component.
        type: React.PropTypes.string,

        // The value that should initially be given to the Input component.
        initialValue: React.PropTypes.any,

        // The autocomplete attribute to be passed to the
        autoComplete: React.PropTypes.bool,

        disabled: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            initialValue: '',
            autoComplete: true
        };
    },

    getInitialState: function () {
        return {
            value: this.props.initialValue,
            pending: false
        };
    },

    getInputDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.input);
    },

    componentWillReceiveProps: function (nextProps) {
        // If the initialValue has changed. Remove the pending state on the component. This will remove the spinner on
        // the save button and enable the Input component again.
        if (nextProps.initialValue !== this.props.initialValue) {
            this.setState({
                pending: false,
                value: nextProps.initialValue
            });
        }
    },

    /**
     * Resets the setting value to the initialValue if the form component loses focus. Clicking the saveButton does not
     * make the form lose focus. The form is intentionally blurred once an updated initialValue is received in props.
     */
    handleBlur: function (event) {
        var focusedOnButton = event.relatedTarget && event.relatedTarget.type !== 'submit';
        if (!this.state.pending && focusedOnButton) this.setState({value: this.props.initialValue});
    },

    /**
     * Handle the data from a change in the input element. Updates state to reflect what is being typed by the user.
     *
     * @param event {event} - the change event from the FormControl
     */
    handleChange: function (event) {
        this.setState({value: event.target.value});
    },

    /**
     * Handles a submit event on the form. If the setting has changed the onSave function (passed as a prop) is called.
     * A spinner is shown to indicate the change is pending. The spinner will be removed when a new initialValue is
     * received in props.
     *
     * @param event {object} - the submit event.
     */
    handleSubmit: function (event) {
        event.preventDefault();

        if (this.state.value !== this.props.initialValue) {
            // If the new value is different to the initial one, show a spinner and call the onSave function. Show a
            // spinner to indicate the request is pending. Drop focus from the form children.
            this.setState({pending: true}, function () {
                this.props.onSave({
                    value: this.state.value,
                    name: this.props.name
                });

                this.blur();
            });
        } else {
            // Drop focus from the form children even though no information has been sent to the server or passed to the
            // parent component.
            this.blur();
        }
    },

    focus: function () {
        this.getInputDOMNode().focus();
    },

    /**
     * Blur all focus-sensitive elements in the component.
     *
     * @func
     */
    blur: function () {
        ReactDOM.findDOMNode(this.refs.button).blur();
        ReactDOM.findDOMNode(this.refs.input).blur();
    },

    render: function () {
        var label = this.props.label ?  <ControlLabel>{this.props.label}</ControlLabel>: null;

        var disabled = this.state.pending || this.props.disabled;

        return (
            <form onSubmit={this.handleSubmit}>
                <FormGroup>
                    {label}
                    <InputGroup>
                        <FormControl
                            ref='input'
                            type={this.props.type}
                            autoComplete={this.props.autoComplete ? "on": "off"}
                            onChange={this.handleChange}
                            onBlur={this.handleBlur}
                            value={this.state.value}
                            disabled={disabled}
                        />
                        <InputGroup.Button>
                            <Button ref='button' bsStyle='primary' type='submit' disabled={disabled}>
                                <Icon name='floppy' pending={this.state.pending} />
                            </Button>
                        </InputGroup.Button>
                    </InputGroup>
                </FormGroup>
            </form>
        );
    }

});

module.exports = InputSave;
