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
        label: React.PropTypes.string,
        name: React.PropTypes.string,
        type: React.PropTypes.string,
        value: React.PropTypes.any,
        autoComplete: React.PropTypes.bool,

        error: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        errorPlacement: React.PropTypes.string,

        onHide: React.PropTypes.func,
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

        return (
            <div>
                <FormGroup>
                    <InputGroup disabled={this.state.pending}>
                        <ControlLabel>{this.props.label}</ControlLabel>
                        <FormControl
                            ref="input"
                            type={this.props.type}
                            name={this.props.name}
                            value={this.props.value}
                            onHide={this.props.onHide}
                            onChange={this.props.onChange}
                            autoComplete={this.props.autoComplete ? "on": "off"}
                        />
                    </InputGroup>
                </FormGroup>
                {overlay}
            </div>
        );
    }
});

module.exports = Input;
