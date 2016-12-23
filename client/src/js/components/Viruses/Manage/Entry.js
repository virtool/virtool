/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusEntry
 */

'use strict';

var _ = require('lodash');
import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var ProgressBar = require('react-bootstrap/lib/ProgressBar');

var Icon = require('virtool/js/components/Base/Icon');
var Flex = require('virtool/js/components/Base/Flex');
var RelativeTime = require('virtool/js/components/Base/RelativeTime');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var VirusEntry = React.createClass({

    getInitialState: function () {
        return {
            in: false
        };
    },

    showDetail: function () {
        dispatcher.router.setExtra(["detail", this.props._id]);
    },

    archive: function (event) {
        event.stopPropagation();
        dispatcher.db.jobs.request("remove_job", {_id: this.props._id});
    },

    render: function () {

        return (
            <ListGroupItem bsStyle={this.props.modified ? "warning": null} className="spaced" onClick={this.showDetail}>
                <Row>
                    <Col md={6}>
                        <strong>{this.props.name}</strong>
                    </Col>
                    <Col md={6}>
                        {this.props.abbreviation}
                        {this.props.modified ? <Icon bsStyle="warning" style={{marginTop: "3px"}} name="flag" pullRight /> : null}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
});

module.exports = VirusEntry;
