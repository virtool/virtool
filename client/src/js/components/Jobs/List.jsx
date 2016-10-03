/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobList
 */

'use strict';

var _ = require("lodash");
var React = require('react');
var FlipMove = require('react-flip-move');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var JobEntry = require('./Entry.jsx');
var JobDetail = require('./Detail/Detail.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

/**
 * A React component that is a simple composition of JobsTable. Applies a baseFilter that includes only active jobs.
 *
 * @class
 */
var JobList = React.createClass({

    propTypes: {
        route: React.PropTypes.object.isRequired,
        documents: React.PropTypes.arrayOf(React.PropTypes.object),

    },

    shouldComponentUpdate: function (nextProps) {
        return !_.isEqual(this.props.documents, nextProps.documents) || this.props.route !== nextProps.route;
    },

    componentWillUnmount: function () {
        this.hideModal();
    },

    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    render: function () {

        var jobComponents;

        if (this.props.documents && this.props.documents.length > 0) {
            jobComponents = this.props.documents.map(function (document) {
                return <JobEntry key={document._id} {...document} />
            });
        } else {
            jobComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No jobs found.
                </ListGroupItem>
            )
        }

        var detailTarget = dispatcher.db.jobs.findOne({_id: this.props.route.extra[1]});

        return (
            <div>
                <FlipMove typeName="div" className="list-group">
                    {jobComponents}
                </FlipMove>

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={JobDetail}
                    collection={dispatcher.db.jobs}
                />
            </div>
        );
    }
});

module.exports = JobList;