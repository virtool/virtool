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
var Badge = require('react-bootstrap/lib/Badge');
var Input = require('react-bootstrap/lib/Input');

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
        return this.refs.input.getInputDOMNode();
    },

    /**
     * Calls the onChange prop function, passing the event object from the input element. Triggered in response to a
     * change event in the input element.
     *
     * @param event {object} - the change event.
     * @func
     */
    handleChange: function (event) {
        this.props.onChange(event);
    },

    render: function () {
        // The label for the Input component. Includes a dynamic badge showing the sequence length.
        var label = <span>Sequence <Badge>{this.props.sequence.length}</Badge></span>;

        return (
            <div>
                <Input
                    type='textarea'
                    name='sequence'
                    ref='input'
                    label={label}
                    rows={5}
                    onChange={this.handleChange}
                    value={this.props.sequence}
                    readOnly={this.props.readOnly}
                    className='sequence'
                />
            </div>
        );
    }
});

module.exports = SequenceField;