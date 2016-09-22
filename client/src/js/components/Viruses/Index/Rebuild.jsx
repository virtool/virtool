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
var Collapse = require('react-bootstrap/lib/Collapse');

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
        this.setState({
            canRebuild: dispatcher.user.permissions.rebuild_index
        });
    },

    /**
     * Sends a request to the server to rebuild the index. Changes state to indicate a pending server operation.
     * Triggered by clicking the rebuild button.
     *
     * @func
     */
    rebuild: function () {
        this.setState({pending: true}, function () {
            dispatcher.db.indexes.request('rebuild_index')
                .success(function () {
                    this.setState({pending: false, error: false});
                }, this)
                .failure(function () {
                    this.setState({pending: false, error: true});
                }, this);
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

        var button;
        var message;

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
                    <Flex.Item pad={20}>
                        <PushButton bsStyle='primary' onClick={this.rebuild} disabled={this.state.pending} pullRight>
                            <Icon name='hammer' pending={this.state.pending}/>&nbsp;
                            {this.state.pending ? 'Rebuilding' : 'Rebuild'}
                        </PushButton>
                    </Flex.Item>
                );
            }

        } else {
            message = (
                <span>
                    <Icon name='info' /> No viruses have been modified since the last index build.
                </span>
            );
        }

        return (
            <div>
                <Alert bsStyle='info'>
                    <Flex alignItems="center">
                        <Flex.Item grow={1}>
                            {message}
                        </Flex.Item>
                        {button}
                    </Flex>
                </Alert>

                <Collapse in={this.state.error}>
                    <div>
                        <Alert bsStyle='danger' onDismiss={this.dismissError}>
                            <Icon name='warning' />&nbsp;
                            <strong>
                                One or more viruses are in an unverified state. All virus documents must be verified before
                                the index can be rebuilt.
                            </strong>
                        </Alert>
                    </div>
                </Collapse>
            </div>
        );
    }

});

module.exports = IndexRebuild;
