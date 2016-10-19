/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusList
 */

'use strict';

var _ = require("lodash");
var React = require('react');
var FlipMove = require('react-flip-move');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var VirusEntry = require('./Entry.jsx');
var VirusDetail = require('./Detail.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Paginator = require('virtool/js/components/Base/Paginator.jsx');
var DetailModal = require('virtool/js/components/Base/DetailModal.jsx');

/**
 * A React component that is a simple composition of JobsTable. Applies a baseFilter that includes only active jobs.
 *
 * @class
 */
var VirusList = React.createClass({

    propTypes: {
        route: React.PropTypes.object.isRequired,
        documents: React.PropTypes.arrayOf(React.PropTypes.object)
    },

    getInitialState: function () {
        return {
            page: 1
        };
    },

    componentWillUnmount: function () {
        this.hideModal();
    },

    setPage: function (page) {
        this.setState({
            page: page
        });
    },

    hideModal: function () {
        dispatcher.router.clearExtra();
    },

    render: function () {

        var pages = Paginator.calculatePages(this.props.documents, this.state.page, 18);

        var virusComponents;

        if (pages.documents && pages.documents.length > 0) {
            virusComponents = pages.documents.map(function (document) {
                return (
                    <VirusEntry
                        key={document._id}
                        {...document}
                    />
                );
            }, this);
        } else {
            virusComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No viruses found.
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

        var detailTarget;

        if (this.props.route.extra[0] === 'detail') {
            detailTarget = dispatcher.db.viruses.findOne({_id: this.props.route.extra[1]});
        }

        return (
            <div>
                <FlipMove typeName="div" className="list-group" leaveAnimation={false}>
                    {virusComponents}
                </FlipMove>

                {paginator}

                <DetailModal
                    target={detailTarget}
                    onHide={this.hideModal}
                    contentComponent={VirusDetail}
                    collection={dispatcher.db.viruses}
                />
            </div>
        );
    }
});

module.exports = VirusList;