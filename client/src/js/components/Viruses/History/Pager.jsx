/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HistoryPager
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var FlipMove = require('react-flip-move');
var Panel = require('react-bootstrap/lib/Panel');
var Pagination = require('react-bootstrap/lib/Pagination');

var Virus = require('./Virus.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

/**
 * A component that shows the history of changes made to viruses in the database.
 *
 * @class
 */
var HistoryPager = React.createClass({

    propTypes: {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        perPage: React.PropTypes.number
    },

    getDefaultProps: function () {
        return {
            perPage: 20
        };
    },

    getInitialState: function () {
        return {
            page: 1,
            canModify: dispatcher.user.permissions.modify_virus
        };
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.onUserChange);
    },

    componentWillUnmount: function () {
        dispatcher.user.on('change', this.onUserChange);
    },

    onUserChange: function () {
        var modifyVirus = dispatcher.user.permissions.modify_virus;

        if (this.state.canModify !== modifyVirus) {
            this.setState({
                canModify: dispatcher.user.permissions.modify_virus
            });
        }
    },

    handleSelect: function (event, selectedEvent) {
        this.setState({
            page: selectedEvent.eventKey
        });
    },

    render: function () {

        var panelStyle = {
            marginBottom: '5px'
        };

        // Get a rough number of pages.
        var roughPageCount = this.props.documents.length / this.props.perPage;

        // If pageCount is less than 1, set pageCount to 1 otherwise round the pageCount to the nearest whole number.
        var pageCount = roughPageCount >= 1 ? Math.ceil(roughPageCount): 1;

        // Determine the indexes of the slice of documents that should be taken to generate the page.
        var endIndex = this.state.page * this.props.perPage;
        var startIndex = endIndex - this.props.perPage;

        // The documents that make up the page.
        var documents = this.props.documents.slice(startIndex, endIndex);

        var content;

        var virusComponents = documents.map(function (virusGroup, index) {
            var header = <h5>{virusGroup.virusName} <small> {virusGroup.virusId}</small></h5>;

            return (
                <Panel key={virusGroup.virusId} eventKey={index} header={header} style={panelStyle} collapsible>
                    <Virus
                        history={virusGroup.history}
                        virus={virusGroup.virusId}
                        method={this.methods}
                        canModify={this.state.canModify}
                    />
                </Panel>
            );
        }.bind(this));

        if (virusComponents.length === 0) {
            // Show an info message if there are no changed viruses.
            content = (
                <Panel>
                    <div className='text-center'><Icon name='info' /> No changes found.</div>
                </Panel>
            );
        } else {
            var paginator;

            if (pageCount > 1) {
                paginator = (
                    <div className='text-center'>
                        <Pagination
                            onSelect={this.handleSelect}
                            activePage={this.state.page}
                            items={pageCount}
                            maxButtons={10}
                            first
                            last
                            next
                            prev
                        />
                    </div>
                );
            }

            // Render panels with list groups of history items.
            content = (
                <div>
                    <FlipMove typeName="div" className="panel-group" duration={200} leaveAnimation={false}>
                        {virusComponents}
                    </FlipMove>

                    {paginator}
                </div>
            );
        }

        return (
            <div>
                {content}
            </div>
        )
    }
});

module.exports = HistoryPager;