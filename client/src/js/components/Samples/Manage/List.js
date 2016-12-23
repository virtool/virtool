/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesList
 */

'use strict';

import React from "react";
import FlipMove from "react-flip-move"
var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon');
var Paginator = require('virtool/js/components/Base/Paginator');
var RelativeTime = require('virtool/js/components/Base/RelativeTime');

var SampleEntry = require("./Entry");

/**
 * A component based on DynamicTable that displays sample documents and allows them to be removed, archived, and viewed in
 * detail in a modal.
 *
 * @class
 */
var SamplesList = React.createClass({

    getInitialState: function () {
        return {
            page: 1
        };
    },

    setPage: function (page) {
        this.setState({
            page: page
        });
    },

    /**
     * Send a request to the server to archive the passed target(s).
     *
     * @param targets {array,object} - one or more targets to request and archive for.
     * @func
     */
    archive: function (targets) {
        dispatcher.db.samples.request('archive', {_id: _.map(targets, '_id')});
    },

    render: function () {

        var pages = Paginator.calculatePages(this.props.documents, this.state.page, 18);

        var sampleComponents = pages.documents.map((document) => {
            return (
                <SampleEntry
                    key={document._id}
                    {...document}

                    selecting={this.props.selecting}
                    toggleSelect={this.props.toggleSelect}

                    quickAnalyze={this.props.quickAnalyze}
                />
            );
        });

        if (sampleComponents.length === 0) {
            sampleComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No samples found.
                </ListGroupItem>
            );
        }

        var paginator;

        if (pages.count > 1) {
            paginator = (
                <Paginator
                    page={this.state.page}
                    count={pages.count}
                    onChange={this.setPage}
                />
            );
        }

        return (
            <div>
                <FlipMove typeName="div" className="list-group" staggerDurationBy={20} leaveAnimation={false}>
                    {sampleComponents}
                </FlipMove>

                {paginator}
            </div>
        );
    }
});

module.exports = SamplesList;