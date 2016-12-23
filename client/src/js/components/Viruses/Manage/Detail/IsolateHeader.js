/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IsolateHeader
 */

'use strict';

import { formatIsolateName } from "virtool/js/utils";

import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

/**
 * A descriptive header for Isolate components. The only subcomponent visible unless the Isolate is adding or editing.
 *
 * @class
 */
var IsolateHeader = React.createClass({

    propTypes: {
        sourceType: React.PropTypes.string,
        sourceName: React.PropTypes.string
    },

    render: function () {
        return (
            <h5>
                <Row>
                    <Col md={9}>
                        {formatIsolateName(this.props)}
                    </Col>
                    <Col md={3}>
                        {this.props.children}
                    </Col>
                </Row>
            </h5>
        );
    }
});

module.exports = IsolateHeader;