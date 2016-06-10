/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports InputError
 */

'use strict';

var React = require('react');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var Input = require('react-bootstrap/lib/Input');

var InputError = React.createClass({

    propTypes: {
        error: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        placement: React.PropTypes.string
    },

    getDefaultProps: function () {
        return {
            placement: 'top'
        };
    },

    getInputDOMNode: function () {
        return this.refs.input.getInputDOMNode();
    },

    render: function () {

        var overlay;

        if (this.props.error) {
            // Set up an overlay to display if there is an error in state.
            var overlayProps = {
                target: this.getInputDOMNode,
                animation: false,
                placement: this.props.placement
            };

            overlay = (
                <Overlay {...overlayProps} show={true} onHide={this.dismissError}>
                    <Popover id='input-error-popover'>
                        {this.props.error}
                    </Popover>
                </Overlay>
            );
        }

        return (
            <div>
                <Input ref='input' {...this.props} />
                {overlay}
            </div>
        );
    }
});

module.exports = InputError;
