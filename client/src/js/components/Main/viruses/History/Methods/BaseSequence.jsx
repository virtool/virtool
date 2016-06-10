/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports BaseSequenceMethod
 */

'use strict';

var React = require('react');
var Col = require('react-bootstrap/lib/Col');
var Row = require('react-bootstrap/lib/Row');
var Badge = require('react-bootstrap/lib/Badge');
var Input = require('react-bootstrap/lib/Input');

/**
 * A readOnly form that describes an added sequence. Used as a part of history detail modals showing sequence changes.
 *
 * @class
 */
var BaseSequenceMethod = React.createClass({

    propTypes: {
        sequence: React.PropTypes.object.isRequired
    },

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        // A label for the textarea input showing the sequence. Includes a badge to show the sequence length.
        var textAreaLabel = <span>Sequence <Badge>{this.props.sequence.sequence.length}</Badge></span>;

        return (
            <div>
                <Row>
                    <Col md={6}>
                        <Input
                            type='text'
                            label='Accession'
                            value={this.props.sequence._id}
                            readOnly
                        />
                    </Col>
                    <Col md={6}>
                        <Input
                            type='text'
                            label='Host'
                            value={this.props.sequence.host  || 'Unknown'}
                            readOnly
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Input
                            type='text'
                            label='Definition'
                            value={this.props.sequence.definition}
                            readOnly
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Input
                            type='textarea'
                            label={textAreaLabel}
                            value={this.props.sequence.sequence}
                            readOnly
                            rows={10}
                            className='sequence'
                        />
                    </Col>
                </Row>
            </div>
        );
    }
});

module.exports = BaseSequenceMethod;