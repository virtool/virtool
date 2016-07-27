/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Index
 */

'use strict';

var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var Label = require('react-bootstrap/lib/Label');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Entry = require('./Index/Entry.jsx');
var Rebuild = require('./Index/Rebuild.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
var Index = React.createClass({

    getInitialState: function () {
        return {
            historyEntries: dispatcher.db.history.documents,
            indexEntries: dispatcher.db.indexes.documents
        }
    },

    componentDidMount: function () {
        dispatcher.db.indexes.on('change', this.update);
        dispatcher.db.history.on('change', this.update);
        dispatcher.db.viruses.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.indexes.off('change', this.update);
        dispatcher.db.history.off('change', this.update);
        dispatcher.db.viruses.off('change', this.update);
    },

    /**
     * Refresh state when the index or history collection changes. Triggered by a collection 'update' event.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {
        if (dispatcher.db.viruses.documents.length > 0) {
            // Set to true when a ready index has been seen when mapping through the index documents. Used to mark only the
            // newest ready index with a checkmark in the index list.
            var haveSeenReady = false;

            // Render a ListGroupItem for each index version. Mark the first ready index with a checkmark by setting the
            // showReady prop to true.
            var indexComponents = _.sortBy(this.state.indexEntries, 'index_version').reverse().map(function (document) {
                var showReady = !document.ready || !haveSeenReady;
                haveSeenReady = document.ready;
                return <Entry key={document._id} showReady={showReady} {...document}/>;
            });

            return (
                <div>
                    <Rebuild
                        documents={this.state.historyEntries}
                        collection={dispatcher.db.viruses}
                    />
                    <ListGroup condensed>
                        {indexComponents}
                    </ListGroup>
                </div>
            );
        } else {
            return (
                <Alert bsStyle='warning'>
                    <Icon name='warning' /> At least one virus must be added to the database before an index can be built.
                </Alert>
            );
        }
    }

});

module.exports = Index;
