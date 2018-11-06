import React from "react";
import PropTypes from "prop-types";
import { FormControl } from "react-bootstrap";
import { Flex, FlexItem, Button } from "./index";

/**
 * An Input component combined with a save button addon.
 */
export class InputSave extends React.Component {
    constructor(props) {
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
        onChange: PropTypes.func,
        disabled: PropTypes.bool,
        noMargin: PropTypes.bool,
        error: PropTypes.string
    };

    static defaultProps = {
        initialValue: "",
        autoComplete: true
    };

    componentDidUpdate(prevProps) {
        if (this.props.initialValue !== prevProps.initialValue) {
            this.setState({
                pending: false,
                value: this.props.initialValue
            });
        }
    }

    /**
     * Resets the setting value to the initialValue if the form component loses focus. Clicking the saveButton does not
     * make the form lose focus. The form is intentionally blurred once an updated initialValue is received in props.
     */
    handleBlur = e => {
        // If click on focus element that does not submit, reset value
        if (!this.state.pending && e.relatedTarget && e.relatedTarget.type !== "submit") {
            this.setState({ value: this.props.initialValue });
            // If click on non focus element, reset value
        } else if (!e.relatedTarget) {
            this.setState({ value: this.props.initialValue });
        }

        // If click on focus element that does submit, keep value
        if (this.props.onChange) {
            this.props.onChange(e);
        }
    };

    /**
     * Handle the data from a change in the input element. Updates state to reflect what is being typed by the user.
     *
     * @param e {event} - the change event from the FormControl
     */
    handleChange = e => {
        if (!this.props.disabled) {
            this.setState({ value: e.target.value });
        }

        if (this.props.onChange) {
            this.props.onChange(e);
        }
    };

    /**
     * Handles a submit event on the form. If the setting has changed the onSave function (passed as a prop) is called.
     * A spinner is shown to indicate the change is pending. The spinner will be removed when a new initialValue is
     * received in props.
     *
     * @param e {object} - the submit event.
     */
    handleSubmit = e => {
        e.preventDefault();

        if (this.state.value === this.props.initialValue) {
            // Drop focus from the form children even though no information has been sent to the server or passed to the
            // parent component.
            this.blur();
        } else {
            // If the new value is different to the initial one, show a spinner and call the onSave function. Show a
            // spinner to indicate the request is pending. Drop focus from the form children.
            this.setState({ pending: true }, () => {
                this.props.onSave({
                    value: this.state.value,
                    name: this.props.name,
                    min: this.props.min,
                    max: this.props.max
                });
                this.blur();
            });
        }
    };

    focus = () => {
        this.inputNode.focus();
    };

    blur = () => {
        this.inputNode.blur();
        this.buttonNode.blur();
    };

    render() {
        const formMargin = this.props.noMargin ? "0" : "15px";

        const formClass = this.props.error ? "form-control-error" : "";

        return (
            <form onSubmit={this.handleSubmit}>
                <h5>
                    <strong>{this.props.label}</strong>
                </h5>
                <Flex alignItems="stretch" style={{ marginBottom: formMargin }}>
                    <FlexItem grow={1} shrink={1}>
                        <FormControl
                            className={formClass}
                            name={this.props.name}
                            inputRef={ref => (this.inputNode = ref)}
                            type={this.props.type}
                            min={this.props.min}
                            max={this.props.max}
                            step={this.props.step}
                            autoComplete={this.props.autoComplete ? "on" : "off"}
                            onChange={this.handleChange}
                            onBlur={this.handleBlur}
                            onInvalid={this.props.onInvalid}
                            value={this.state.value}
                            disabled={this.props.disabled}
                            style={{ marginBottom: "0" }}
                        />
                    </FlexItem>
                    <Button
                        type="submit"
                        bsStyle="primary"
                        disabled={this.props.disabled}
                        icon="save"
                        ref={button => (this.buttonNode = button)}
                    />
                </Flex>
            </form>
        );
    }
}
