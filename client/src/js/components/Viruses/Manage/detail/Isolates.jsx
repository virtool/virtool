/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports Isolates
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var SequenceList = require('./Sequences/List.jsx');
var IsolateList = require('./IsolateList.jsx');

/**
 * The isolate editor component that contains child components for viewing and editing isolates and sequences associated
 * with the virus.
 *
 * @class
 */
var Isolates = React.createClass({

    propTypes: {
        virusId: React.PropTypes.string.isRequired,
        data: React.PropTypes.array.isRequired,
        settings: React.PropTypes.object.isRequired,
        canModify: React.PropTypes.bool
    },

    getInitialState: function () {
        // Default activeIsolateId is the id of the first isolate or null if no isolates are present.
        return {activeIsolateId: this.props.data.length > 0 ? this.props.data[0].isolate_id: null};
    },

    componentWillReceiveProps: function (nextProps) {
        // In this case the active isolate has been removed (only the active isolate shows a remove icon), the
        // activeIsolateId has to changed before the removal is rendered.
        if (nextProps.data.length > 0 && nextProps.data.length < this.props.data.length) {
            // Find the id of the removed isolate.
            var removedId = _.difference(
                _.map(this.props.data, 'isolate_id'),
                _.map(nextProps.data, 'isolate_id')
            )[0];

            // Find the index of the remove isolate in the current unupdated set of isolates.
            var removedIndex = _.findIndex(this.props.data, {isolate_id: removedId});

            // Set state such that the active isolate is the one before the isolate.
            this.selectIsolate(this.props.data[removedIndex - 1].isolate_id);
        }
    },

    componentDidUpdate: function (prevProps) {
        if (prevProps.data !== this.props.data) {
            // A new isolate was added.
            if (this.props.data.length > 0 && this.props.data.length > prevProps.data.length) {
                var lastIsolate = this.props.data[this.props.data.length - 1];
                this.setState({activeIsolateId: lastIsolate.isolate_id});
            }

            // Only one isolate is present.
            if (this.props.data.length === 1) {
                this.setState({activeIsolateId: this.props.data[0].isolate_id});
            }

            // No isolates are associated with the sample.
            if (this.props.data.length === 0) {
                this.setState({activeIsolateId: null});
            }
        }
    },

    /**
     * Set a new active isolate using the passed isolateId. Triggered in response to a click on a Isolate component.
     *
     * @param activeIsolateId {string} - the id of the new active isolate.
     * @func
     */
    selectIsolate: function (activeIsolateId) {
        this.setState({activeIsolateId: activeIsolateId});
    },

    /**
     * Toggle whether an add-isolate form should be shown. Triggered by clicking the add-isolate button or by cancelling
     * the add-isolate form.
     *
     * @func
     */
    toggleAdding: function () {
        var newActiveIsolateId = 'new';

        if (this.state.activeIsolateId === 'new') {
            if (this.props.data.length > 0) newActiveIsolateId = this.props.data[0].isolate_id;
            if (this.props.data.length === 0) newActiveIsolateId = null;
        }

        this.selectIsolate(newActiveIsolateId);
    },

    render: function () {

        var sharedProps = {
            virusId: this.props.virusId,
            settings: this.props.settings,
            activeIsolateId: this.state.activeIsolateId,
            canModify: this.props.canModify
        };

        // Get the entire active isolate document.
        var activeIsolate = _.find(this.props.data, {isolate_id: this.state.activeIsolateId});

        // Get the array of sequences from the isolate.
        var sequenceData = activeIsolate && activeIsolate.hasOwnProperty('sequences') ? activeIsolate.sequences: [];

        return (
            <div className='clearfix'>
                <Row>
                    <Col md={4}>
                        <IsolateList
                            {...sharedProps}
                            selectIsolate={this.selectIsolate}
                            toggleAdding={this.toggleAdding}
                            data={this.props.data}
                        />
                    </Col>
                    <Col md={8}>
                        <SequenceList
                            {...sharedProps}
                            isolateId={this.state.activeIsolateId}
                            data={sequenceData}
                        />
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = Isolates;