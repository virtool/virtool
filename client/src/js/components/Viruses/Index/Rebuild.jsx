/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IndexRebuild
 */

var React = require('react');
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var IndexRebuild = React.createClass({

    getInitialState: function () {
        return {
            verified: false,
            pending: false,
            error: false,
            canRebuild: dispatcher.user.permissions.rebuild_index
        }
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.onUserChange);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.onUserChange);
    },

    onUserChange: function () {
        if (dispatcher.user.permissions.rebuild_index != this.state.canRebuild) {
            this.setState({
                canRebuild: dispatcher.user.permissions.rebuild_index
            });
        }
    },

    /**
     * Sends a request to the server to rebuild the index. Changes state to indicate a pending server operation.
     * Triggered by clicking the rebuild button.
     *
     * @func
     */
    rebuild: function () {
        this.setState({pending: true}, function () {
            dispatcher.db.indexes.request('rebuild', {}, this.onRebuildSuccess, this.onRebuildFailure);
        });
    },

    /**
     * A function to call if the rebuild request fails. This occurs when some of the viruses in the database are.
     * unverified. Sets states to show an error and stop show pending state.
     *
     * @func
     */
    onRebuildFailure: function () {
        this.setState({
            pending: false,
            error: true
        });
    },

    /**
     * A function to call when a rebuild request succeeds. Turns off pending state to indicate to the user that the
     * request succeeded.
     *
     * @func
     */
    onRebuildSuccess: function () {
        this.setState({
            pending: false,
            error: false
        });
    },

    /**
     * Dismiss the red error alert by setting state.error to false. Called by clicking the close button in the error
     * alert.
     *
     * @func
     */
    dismissError: function () {
        this.setState({error: false});
    },

    render: function () {

        // Get history documents whose changes are unbuilt ('not included in index yet').
        var unindexed = _.filter(this.props.documents, {index_version: 'unbuilt'});

        var message = (
            <span>
                <Icon name='info' /> No viruses have been modified since the last index build.
            </span>
        );

        var button;
        var errorComponent;

        // Show a notification
        if (unindexed.length > 0 || this.props.documents.length === 0) {
            message = (
                <span>
                    <Icon name='notification' />&nbsp;
                    <span>
                        The virus reference database has changed and the index must be rebuilt before the new information
                        will be included in future analyses.
                    </span>
                </span>
            );

            if (this.state.canRebuild) {
                button = (
                    <PushButton bsStyle='primary' onClick={this.rebuild} disabled={this.state.pending} pullRight>
                        <Icon name='hammer' pending={this.state.pending}/>&nbsp;
                        {this.state.pending ? 'Rebuilding' : 'Rebuild'}
                    </PushButton>
                );
            }

            if (this.state.error) {
                errorComponent = (
                    <Alert bsStyle='danger' onDismiss={this.dismissError}>
                        <Icon name='warning' />&nbsp;
                        <strong>
                            One or more viruses are in an unverified state. All virus documents must be verified before
                            the index can be rebuilt.
                        </strong>
                    </Alert>
                );
            }
        }

        return (
            <div>
                <Alert bsStyle='info'>
                    <Flex>
                        <Flex.Item grow={1}>
                            {message}
                        </Flex.Item>
                        <Flex.Item pad={20}>
                            {button}
                        </Flex.Item>
                    </Flex>
                </Alert>

                {errorComponent}
            </div>
        );
    }

});

module.exports = IndexRebuild;
