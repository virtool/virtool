/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UpsertIsolateMethod
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Utils = require('virtool/js/Utils');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A text component for a HistoryItem describing the addition of a new isolate.
 *
 * @class
 */
var IsolateAddition = React.createClass({

    propTypes: {
        changes: React.PropTypes.oneOfType([React.PropTypes.array, React.PropTypes.object]).isRequired
    },

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        var isolateAdd = _.find(this.props.changes, function (change) {
            return change[1] == 'isolates' || change[1][0] == 'isolates';
        });

        var isolate = isolateAdd[2][0][1];

        return (
            <span>
                <Icon name='lab' bsStyle='primary' />
                <span> Added isolate <em>{Utils.formatIsolateName(isolate)} ({isolate.isolate_id})</em></span>
            </span>
        );
    }

});

/**
 * A text component for a History Item describing changes in an isolate name resulting from isolate_upsert.
 *
 * @class
 */
var IsolateRename = React.createClass({

    propTypes: {
        changes: React.PropTypes.oneOfType([React.PropTypes.array, React.PropTypes.object]).isRequired,
        annotation: React.PropTypes.any.isRequired
    },

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        // The old isolate object is stored in the history document annotation.
        var oldIsolateName = Utils.formatIsolateName(this.props.annotation);

        // Get the changes that were applied to the isolate.
        var isolateChanges = _.filter(this.props.changes, function (change) {
            return change[1][0] == 'isolates';
        });

        // Clone the old isolate object to use as a basis for constructing the new one from the changes.
        var newIsolate = _.clone(this.props.annotation);

        // Change the newIsolate object using the changes array.
        _.forEach(isolateChanges, function (change) {
            if (change[1][2] === 'source_type') newIsolate.source_type = change[2][1];
            if (change[1][2] === 'source_name') newIsolate.source_name = change[2][1];
        }, this);

        return (
            <span>
                <Icon name='lab' bsStyle='warning' />
                <span> Renamed <em>{oldIsolateName}</em> to </span>
                <em>
                    {Utils.formatIsolateName(newIsolate)} ({this.props.annotation.isolate_id})
                </em>
            </span>
        );

    }

});

/**
 * A component that renders either IsolateRename or IsolateAddition as a subcomponent.
 *
 * @class
 */
var UpsertIsolateMethod = React.createClass({

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        if (this.props.annotation) {
            return <IsolateRename changes={this.props.changes} annotation={this.props.annotation} />;
        } else {
            return <IsolateAddition changes={this.props.changes} />;
        }
    }
});

module.exports = UpsertIsolateMethod;