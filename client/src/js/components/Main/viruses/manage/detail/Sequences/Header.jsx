/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SequenceHeader
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

/**
 * The header that is always shown at the top of a Sequence component. Displays the sequence accession and definition
 * and icons for managing the Sequence component's state. Icons are passed in as children.
 *
 * @class
 */
var SequenceHeader = React.createClass({

    propTypes: {
        sequenceId: React.PropTypes.string,
        definition: React.PropTypes.string
    },

    /**
     * Stop further propagation of the passed event. Triggered in response to clicking icon buttons. Stops the click
     * from triggering events on the Sequence component.
     *
     * @param event {object} - the click event to stop.
     * @func
     */
    stopPropagation: function (event) {
        event.stopPropagation();
    },

    render: function () {
        return (
            <h5 className='disable-select'>
                <Row>
                    <Col md={10}>
                        <strong>{this.props.sequenceId || 'Accession'}</strong>
                        <span> - {this.props.definition || 'Definition'}</span>
                    </Col>
                    <Col md={2}>
                        <span className='icon-group' onClick={this.stopPropagation}>
                            {this.props.children}
                        </span>
                    </Col>
                </Row>
            </h5>
        );
    }
});

module.exports = SequenceHeader;