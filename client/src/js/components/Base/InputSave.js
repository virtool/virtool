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

import React from "react";
import PropTypes from "prop-types";
import { Flex, FlexItem, Input, Button } from "./";

/**
 * A single input form component with a submit addon button that behaves well for updated VT settings.
 */
export class InputSave extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            value: this.props.initialValue,
            pending: false
        };
    }

    static propTypes = {
        name: PropTypes.string,

        // The function to call with the newValue when the form is submitted.
        onSave: PropTypes.func.isRequired,

        // The label to apply to the Input component.
        label: PropTypes.string,

        // The type attribute to apply to the Input component.
        type: PropTypes.string,

        // The value that should initially be given to the Input component.
        initialValue: PropTypes.any,

        // The autocomplete attribute to be passed to the
        autoComplete: PropTypes.bool,

        disabled: PropTypes.bool
    };

    static defaultProps = {
        initialValue: "",
        autoComplete: true
    };

    componentWillReceiveProps (nextProps) {
        // If the initialValue has changed. Remove the pending state on the component. This will remove the spinner on
        // the save button and enable the Input component again.
        if (nextProps.initialValue !== this.props.initialValue) {
            this.setState({
                pending: false,
                value: nextProps.initialValue
            });
        }
    }

    /**
     * Resets the setting value to the initialValue if the form component loses focus. Clicking the saveButton does not
     * make the form lose focus. The form is intentionally blurred once an updated initialValue is received in props.
     */
    handleBlur = (event) => {
        if (!this.state.pending && event.relatedTarget && event.relatedTarget.type !== "submit") {
            this.setState({value: this.props.initialValue});
        }
    };

    /**
     * Handle the data from a change in the input element. Updates state to reflect what is being typed by the user.
     *
     * @param event {event} - the change event from the FormControl
     */
    handleChange = (event) => {
        this.setState({value: event.target.value});
    };

    /**
     * Handles a submit event on the form. If the setting has changed the onSave function (passed as a prop) is called.
     * A spinner is shown to indicate the change is pending. The spinner will be removed when a new initialValue is
     * received in props.
     *
     * @param event {object} - the submit event.
     */
    handleSubmit = (event) => {
        event.preventDefault();

        if (this.state.value !== this.props.initialValue) {
            // If the new value is different to the initial one, show a spinner and call the onSave function. Show a
            // spinner to indicate the request is pending. Drop focus from the form children.
            this.setState({pending: true}, () => {
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
    };

    focus = () => {
        this.inputNode.focus();
    };

    /**
     * Blur all focus-sensitive elements in the component.
     *
     * @func
     */
    blur = () => {
        this.inputNode.blur();
        this.buttonNode.blur();
    };

    render () {

        const disabled = this.state.pending || this.props.disabled;

        return (
            <form onSubmit={this.handleSubmit}>
                <h5><strong>{this.props.label}</strong></h5>
                <Flex alignItems="stretch" style={{marginBottom: "15px"}}>
                    <FlexItem grow={1} shrink={0}>
                        <Input
                            ref={(node) => this.inputNode = node}
                            type={this.props.type}
                            autoComplete={this.props.autoComplete}
                            onChange={this.handleChange}
                            onBlur={this.handleBlur}
                            value={this.state.value}
                            disabled={disabled}
                            noMargin
                        />
                    </FlexItem>
                    <Button
                        type="submit"
                        bsStyle="primary"
                        disabled={disabled}
                        icon="floppy"
                        ref={(button) => this.buttonNode = button}
                    />
                </Flex>
            </form>
        );


    }

}

