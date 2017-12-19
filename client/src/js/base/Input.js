import React from "react";
import PropTypes from "prop-types";
import { ControlLabel, FormControl, FormGroup, Overlay, Popover } from "react-bootstrap";

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
        noMargin: PropTypes.bool
    };

    static defaultProps = {
        type: "text",
        autoComplete: true,
        errorPlacement: "top",
        formGroupStyle: {}
    };

    focus () {
        this.inputNode.focus();
    }

    render () {

        let overlay;

        if (this.props.error) {
            // Set up an overlay to display if there is an error in state.
            const overlayProps = {
                target: this.inputNode,
                animation: true,
                placement: this.props.errorPlacement
            };

            overlay = (
                <Overlay {...overlayProps} show={true}>
                    <Popover id="input-error-popover">
                        {this.props.error}
                    </Popover>
                </Overlay>
            );
        }

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
                <FormControl
                    inputRef={ref => this.inputNode = ref}
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
                    style={this.props.style}
                >
                    {this.props.children}
                </FormControl>
                {overlay}
            </FormGroup>
        );
    }
}
