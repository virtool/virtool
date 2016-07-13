/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobDetailFooter
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var ConfirmFooter = require('virtool/js/components/Base/ConfirmFooter.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A composition of the ConfirmFooter component for the JobDetail modal.
 */
var JobDetailFooter = React.createClass({

    /**
     * Send a request to the server cancelling the job. Triggered by clicking the cancel button in the ConfirmFooter.
     *
     * @func
     */
    handleCancel: function () {
        dispatcher.collections.jobs.request('cancel', {_id: this.props._id});
    },

    /**
     * Send a request to the server to archive the job. Triggered by clicking the archive button in the ConfirmFooter.
     *
     * @func
     */
    handleArchive: function () {
        dispatcher.collections.jobs.request('archive', {_id: this.props._id});
    },

    /**
     * Send a request to the server to remove the job. Triggered by clicking the remove button in the ConfirmFooter.
     *
     * @func
     */
    handleRemove: function () {
        dispatcher.collections.jobs.request('remove_job', {_id: this.props._id});
    },

    render: function () {

        var lastStatus = _.last(this.props.status);

        // True if the job's last status update has the 'complete' state.
        var isComplete = ['complete', 'error', 'cancelled'].indexOf(lastStatus.state) > -1;

        // Props to pass to the confirm footer. These are modified depending on the state of the job in the
        // conditionals below.
        var footerProps = {
            style: 'danger',
            onHide: this.props.onHide,
            closeOnConfirm: false
        };

        // Lowercase name of the action to be performed when the ConfirmModal is confirmed.
        var action;

        if (!isComplete) {
            footerProps.buttonContent = <span><Icon name='cancel-circle'/> Cancel</span>;
            action = 'cancel';
        }

        if (isComplete && !this.props.archived && _.includes(dispatcher.user.permissions, 'archive_job')) {
            footerProps.buttonContent = <span><Icon name='box-add'/> Archive</span>;
            footerProps.style = 'info';
            action = 'archive';
        }

        if (isComplete && this.props.archived && _.includes(dispatcher.user.permissions, 'remove_job')) {
            footerProps.buttonContent = <span><Icon name='remove' /> Remove</span>;
            footerProps.closeOnConfirm = true;
            action = 'remove';
        }

        // Choose one of the three 'handle' callbacks to pass to the ConfirmFooter as a prop.
        footerProps.callback = this['handle' + _.capitalize(action)];

        // Define a message to display in the ConfirmFooter.
        footerProps.message = 'Are you sure you want to ' + action + ' this job?';

        if (action) return <ConfirmFooter {...footerProps} />;

        return <span />;
    }

});

module.exports = JobDetailFooter;