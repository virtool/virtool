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
        min: PropTypes.number,
        max: PropTypes.number,
        step: PropTypes.number,
        readOnly: PropTypes.bool,
        onInvalid: PropTypes.func,
        placeholder: PropTypes.any,
        autoComplete: PropTypes.bool,
        error: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
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

    render() {
        const formClass = this.props.error ? "form-control-error" : "";

        let componentClass;

        if (this.props.type === "select") {
            componentClass = "select";
        }

        if (this.props.type === "textarea") {
            componentClass = "textarea";
        }

        const style = this.props.type === "number" ? { ...this.props.style, paddingRight: "12px" } : this.props.style;

        let label;

        if (this.props.label) {
            label = <ControlLabel>{this.props.label}</ControlLabel>;
        }

        const groupStyle = { ...this.props.formGroupStyle };

        if (this.props.noMargin) {
            groupStyle.marginBottom = 0;
        }

        return (
            <FormGroup style={groupStyle}>
                {label}
                <FormControl
                    className={formClass}
                    inputRef={ref => (this.inputNode = ref)}
                    type={this.props.type}
                    name={this.props.name}
                    rows={this.props.rows}
                    value={this.props.value || ""}
                    min={this.props.min}
                    max={this.props.max}
                    step={this.props.step}
                    onBlur={this.props.onBlur}
                    onFocus={this.props.onFocus}
                    onChange={this.props.onChange}
                    readOnly={this.props.readOnly}
                    onInvalid={this.props.onInvalid}
                    placeholder={this.props.placeholder}
                    autoComplete={this.props.autoComplete ? "on" : "off"}
                    componentClass={componentClass}
                    disabled={this.props.disabled}
                    style={style}
                >
                    {this.props.children}
                </FormControl>
            </FormGroup>
        );
    }
}
