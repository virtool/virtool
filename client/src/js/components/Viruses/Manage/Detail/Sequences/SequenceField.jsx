/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SequenceField
 */

'use strict';

var React = require('react');
var ReactDOM = require('react-dom');
var Badge = require('react-bootstrap/lib/Badge');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');

/**
 * A component that wraps a textarea input element. Used for displaying and editing genetic sequences.
 *
 * @class
 */
var SequenceField = React.createClass({

    propTypes: {
        sequence: React.PropTypes.string,
        readOnly: React.PropTypes.bool,
        onChange: React.PropTypes.func
    },

    getDefaultProps: function () {
        return {
            sequence: '',
            readOnly: false
        };
    },

    /**
     * Returns the input element DOM node.
     *
     * @returns {object} - the DOM node.
     * @func
     */
    getInputDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.input);
    },

    render: function () {
        return (
            <FormGroup>
                <ControlLabel>
                    Sequence <Badge>{this.props.sequence.length}</Badge>
                </ControlLabel>
                <FormControl
                    ref="input"
                    name="sequence"
                    className="sequence"
                    componentClass="textarea"
                    value={this.props.sequence}
                    onChange={this.props.onChange}
                    readOnly={this.props.readOnly}
                    rows={5}
                />
            </FormGroup>
        );
    }
});

module.exports = SequenceField;