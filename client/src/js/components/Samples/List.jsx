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

var React = require('react');
var FlipMove = require("react-flip-move");
var Alert = require('react-bootstrap/lib/Alert');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

var SampleEntry = require("./Entry.jsx");

/**
 * A component based on DynamicTable that displays sample documents and allows them to be removed, archived, and viewed in
 * detail in a modal.
 *
 * @class
 */
var SamplesList = React.createClass({

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

        var sampleComponents = this.props.documents.data().slice(0, 15).map(function (document) {
            return (
                <SampleEntry
                    key={document._id}
                    {...document}
                    quickAnalyze={this.props.quickAnalyze}
                />
            );
        }, this);

        if (sampleComponents.length === 0) {
            sampleComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No samples found.
                </ListGroupItem>
            );
        }

        return (
            <FlipMove typeName="div" className="list-group" leaveAnimation={false}>
                {sampleComponents}
            </FlipMove>
        );
    }
});

module.exports = SamplesList;