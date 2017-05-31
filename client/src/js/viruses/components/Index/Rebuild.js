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

import React from "react";
import { filter } from "lodash";
import { Alert, Collapse } from "react-bootstrap";
import { Flex, FlexItem, Icon, Button } from "virtool/js/components/Base";

export default class IndexRebuild extends React.PureComponent {

    constructor (props) {
        super(props);

        this.state = {
            verified: false,
            pending: false,
            error: false,
            canRebuild: dispatcher.user.permissions.rebuild_index
        };
    }

    static propTypes = {
        documents: React.PropTypes.arrayOf(React.PropTypes.object)
    };

    componentDidMount () {
        dispatcher.user.on("change", this.onUserChange);
    }

    componentWillUnmount () {
        dispatcher.user.off("change", this.onUserChange);
    }

    onUserChange = () => {
        this.setState({
            canRebuild: dispatcher.user.permissions.rebuild_index
        });
    };

    /**
     * Sends a request to the server to rebuild the index. Changes state to indicate a pending server operation.
     * Triggered by clicking the rebuild button.
     *
     * @func
     */
    rebuild = () => {
        this.setState({pending: true}, () => {
            dispatcher.db.indexes.request("rebuild_index")
                .success(() => {
                    this.setState({
                        pending: false,
                        error: false
                    });
                })
                .failure(() => {
                    this.setState({
                        pending: false,
                        error: true
                    });
                });
        });
    };

    /**
     * Dismiss the red error alert by setting state.error to false. Called by clicking the close button in the error
     * alert.
     *
     * @func
     */
    dismissError = () => {
        this.setState({ error: false });
    };

    render () {

        // Get history documents whose changes are unbuilt ("not included in index yet").
        const unindexed = filter(this.props.documents, {index_version: "unbuilt"});

        let button;
        let message;

        // Show a notification
        if (unindexed.length > 0 || this.props.documents.length === 0) {
            message = (
                <span>
                    <Icon name="notification" />&nbsp;
                    <span>
                        The virus reference database has changed and the index must be rebuilt before the new
                        information will be included in future analyses.
                    </span>
                </span>
            );

            if (this.state.canRebuild) {
                button = (
                    <FlexItem pad={20}>
                        <Button bsStyle="primary" onClick={this.rebuild} disabled={this.state.pending} pullRight>
                            <Icon name="hammer" pending={this.state.pending}/>&nbsp;
                            {this.state.pending ? "Rebuilding" : "Rebuild"}
                        </Button>
                    </FlexItem>
                );
            }

        } else {
            message = (
                <span>
                    <Icon name="info" /> No viruses have been modified since the last index build.
                </span>
            );
        }

        return (
            <div>
                <Alert bsStyle="info">
                    <Flex alignItems="center">
                        <FlexItem grow={1}>
                            {message}
                        </FlexItem>
                        {button}
                    </Flex>
                </Alert>

                <Collapse in={this.state.error}>
                    <div>
                        <Alert bsStyle="danger" onDismiss={this.dismissError}>
                            <Icon name="warning" />&nbsp;
                            <strong>
                                One or more viruses are in an unverified state. All virus documents must be verified
                                before the index can be rebuilt.
                            </strong>
                        </Alert>
                    </div>
                </Collapse>
            </div>
        );
    }

}
