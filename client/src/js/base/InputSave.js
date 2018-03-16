import React from "react";
import PropTypes from "prop-types";
import { FormControl } from "react-bootstrap";
import { Flex, FlexItem, Button } from "./index";

/**
 * An Input component combined with a save button addon.
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
        onSave: PropTypes.func.isRequired,
        label: PropTypes.string,
        type: PropTypes.string,
        min: PropTypes.number,
        max: PropTypes.number,
        step: PropTypes.number,
        initialValue: PropTypes.any,
        autoComplete: PropTypes.bool,
        onInvalid: PropTypes.func,
        disabled: PropTypes.bool,
        noMargin: PropTypes.bool,
        error: PropTypes.string
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
    handleBlur = (e) => {
        if (!this.state.pending && e.relatedTarget && e.relatedTarget.type !== "submit") {
            this.setState({value: this.props.initialValue});
        }
    };

    /**
     * Handle the data from a change in the input element. Updates state to reflect what is being typed by the user.
     *
     * @param event {event} - the change event from the FormControl
     */
    handleChange = (e) => {
        if (!this.props.disabled) {
            this.setState({value: e.target.value});
        }
    };

    /**
     * Handles a submit event on the form. If the setting has changed the onSave function (passed as a prop) is called.
     * A spinner is shown to indicate the change is pending. The spinner will be removed when a new initialValue is
     * received in props.
     *
     * @param e {object} - the submit event.
     */
    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.value === this.props.initialValue) {
            // Drop focus from the form children even though no information has been sent to the server or passed to the
            // parent component.
            this.blur();
        } else {
            // If the new value is different to the initial one, show a spinner and call the onSave function. Show a
            // spinner to indicate the request is pending. Drop focus from the form children.
            this.setState({pending: true}, () => {
                this.props.onSave({
                    value: this.state.value,
                    name: this.props.name
                });

                this.blur();
            });
        }
    };

    focus = () => {
        this.inputNode.focus();
    };

    blur = () => {
        this.buttonNode.blur();
    };

    render () {
        const formStyle = this.props.noMargin ? "0px" : "15px";

        const formClass = this.props.error ? "form-control-error" : "";

        return (
            <form onSubmit={this.handleSubmit}>
                <h5><strong>{this.props.label}</strong></h5>
                <Flex alignItems="stretch" style={{marginBottom: formStyle}}>
                    <FlexItem grow={1} shrink={1}>
                        <FormControl
                            className={formClass}
                            ref={(node) => this.inputNode = node}
                            type={this.props.type}
                            min={this.props.min}
                            max={this.props.max}
                            step={this.props.step}
                            autoComplete={this.props.autoComplete}
                            onChange={this.handleChange}
                            onBlur={this.handleBlur}
                            onInvalid={this.props.onInvalid}
                            value={this.state.value}
                            disabled={this.props.disabled}
                            style={{marginBottom: "0"}}
                        >
                        </FormControl>
                    </FlexItem>
                    <Button
                        type="submit"
                        bsStyle="primary"
                        disabled={this.state.pending || this.props.disabled}
                        icon="floppy"
                        ref={(button) => this.buttonNode = button}
                    />
                </Flex>
            </form>
        );
    }
}
