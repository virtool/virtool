/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IndexEntry
 */

'use strict';

import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Label = require('react-bootstrap/lib/Label');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon');
var RelativeTime = require('virtool/js/components/Base/RelativeTime');

var IndexEntry = React.createClass({

    render: function () {

        var ready;

        // Decide what icon/text should be shown at the right end of the index document. If the index is building a spinner
        // with 'Building' is shown, if the index is the active index a green check is shown. Otherwise, no content is
        // shown at the right.
        if (this.props.showReady) {
            ready = (
                <span className='pull-right'>
                    <Icon name='checkmark' bsStyle='success' pending={!this.props.ready} />
                    <span> {this.props.ready ? 'Active': 'Building'}</span>
                </span>
            );
        }

        // The description of
        var changeDescription;

        if (this.props.modification_count !== null) {
            // Text to show if no changes occured since the last index build. Technically, should never be shown because
            // the rebuild button is not shown if no changes have been made.
            changeDescription = 'No changes';

            // This should always test true in practice. Shows the number of changes and the number of viruses
            // affected.
            if (this.props.modification_count > 0) {
               changeDescription = (
                    <span>
                        {this.props.modification_count} changes made in {this.props.modified_virus_count} viruses
                    </span>
                );
            }
        }

        return (
            <ListGroupItem>
                <Row>
                    <Col md={3}><Label>Version {this.props.index_version}</Label></Col>
                    <Col md={3}>Created <RelativeTime time={this.props.timestamp} /></Col>
                    <Col md={4}>{changeDescription}</Col>
                    <Col md={2}>{ready}</Col>
                </Row>
            </ListGroupItem>
        );
    }

});

module.exports = IndexEntry;