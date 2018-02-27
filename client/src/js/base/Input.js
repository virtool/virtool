import React from "react";
import PropTypes from "prop-types";
import { ControlLabel, FormControl, FormGroup } from "react-bootstrap";

/**
 * A reusable composition of form components from react-bootstrap.
 */
export class Input extends React.Component {

    static propTypes = {
        label: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        name: PropTypes.string,
        type: PropTypes.string,
        rows: PropTypes.number,
        value: PropTypes.any,
        readOnly: PropTypes.bool,
        placeholder: PropTypes.any,
        autoComplete: PropTypes.bool,
        error: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
        errorPlacement: PropTypes.string,
        onHide: PropTypes.func,
        onBlur: PropTypes.func,
        onFocus: PropTypes.func,
        onChange: PropTypes.func,
        style: PropTypes.object,
        formGroupStyle: PropTypes.object,
        children: PropTypes.node,
        noMargin: PropTypes.bool,
        disabled: PropTypes.bool
    };

    static defaultProps = {
        type: "text",
        autoComplete: true,
        errorPlacement: "top",
        formGroupStyle: {}
    };

    /**
     * Blurs the <input /> element. Not used internally. It is intended for use by the parent component.
     */
    blur = () => {
        this.inputNode.blur();
    };

    /**
     * Focus the <input /> element.
     */
    focus = () => {
        this.inputNode.focus();
    };

    render () {

        let errorMessage;

        if (this.props.error) {
            errorMessage = (
                <div style={{display: "inline", color: "red", fontSize: "small", float: "right"}}>
                    {this.props.error}
                </div>
            );
        }

        const inputStyle = this.props.error ? "red" : "";

        let componentClass;

        if (this.props.type === "select") {
            componentClass = "select";
        }

        if (this.props.type === "textarea") {
            componentClass = "textarea";
        }

        let label;

        if (this.props.label) {
            label = (
                <ControlLabel>
                    {this.props.label}
                </ControlLabel>
            );
        }

        const groupStyle = {...this.props.formGroupStyle};

        if (this.props.noMargin) {
            groupStyle.marginBottom = 0;
        }

        return (
            <FormGroup style={groupStyle}>
                {label}
                {errorMessage}
                <FormControl
                    inputRef={(ref) => this.inputNode = ref}
                    type={this.props.type}
                    name={this.props.name}
                    rows={this.props.rows}
                    value={this.props.value || ""}
                    onBlur={this.props.onBlur}
                    onFocus={this.props.onFocus}
                    onChange={this.props.onChange}
                    readOnly={this.props.readOnly}
                    placeholder={this.props.placeholder}
                    autoComplete={this.props.autoComplete ? "on" : "off"}
                    componentClass={componentClass}
                    disabled={this.props.disabled}
                    style={{...this.props.style, borderColor: `${inputStyle}`}}
                >
                    {this.props.children}
                </FormControl>
            </FormGroup>
        );
    }
}
