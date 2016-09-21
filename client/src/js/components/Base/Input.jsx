/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Input
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');
var FormControl = require('react-bootstrap/lib/FormControl');

var Input = React.createClass({

    propTypes: {
        label: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        name: React.PropTypes.string,
        type: React.PropTypes.string,
        rows: React.PropTypes.number,
        value: React.PropTypes.any,
        readOnly: React.PropTypes.bool,
        placeholder: React.PropTypes.any,
        autoComplete: React.PropTypes.bool,

        error: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        errorPlacement: React.PropTypes.string,

        onHide: React.PropTypes.func,
        onBlur: React.PropTypes.func,
        onFocus: React.PropTypes.func,
        onChange: React.PropTypes.func
    },

    getDefaultProps: function () {
        return {
            type: 'text',
            autoComplete: true,
            errorPlacement: 'top'
        };
    },

    getInputDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.input);
    },

    focus: function () {
        this.getInputDOMNode().focus();
    },

    blur: function () {
        this.getInputDOMNode().blur();
    },

    render: function () {

        var overlay;

        if (this.props.error) {
            // Set up an overlay to display if there is an error in state.
            var overlayProps = {
                target: this.getInputDOMNode,
                animation: true,
                placement: this.props.errorPlacement
            };

            overlay = (
                <Overlay {...overlayProps} show={true}>
                    <Popover id='input-error-popover'>
                        {this.props.error}
                    </Popover>
                </Overlay>
            );
        }

        var componentClass;

        if (this.props.type === "select") {
            componentClass = "select";
        }

        if (this.props.type === "textarea") {
            componentClass = "textarea";
        }

        var label;

        if (this.props.label) {
            label = (
                <ControlLabel>
                    {this.props.label}
                </ControlLabel>
            );
        }

        return (
            <div>
                <FormGroup>
                    {label}
                    <FormControl
                        ref="input"
                        type={this.props.type}
                        name={this.props.name}
                        rows={this.props.rows}
                        value={this.props.value}
                        onBlur={this.props.onBlur}
                        onFocus={this.props.onFocus}
                        onChange={this.props.onChange}
                        readOnly={this.props.readOnly}
                        placeholder={this.props.placeholder}
                        autoComplete={this.props.autoComplete ? "on": "off"}
                        componentClass={componentClass}
                    >
                        {this.props.children}
                    </FormControl>
                </FormGroup>
                {overlay}
            </div>
        );
    }
});

module.exports = Input;
