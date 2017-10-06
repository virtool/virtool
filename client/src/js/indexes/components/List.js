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

import React from "react";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";

import { Button, Flex, FlexItem, Icon, ListGroupItem } from "../../base";
import { findIndexes, showRebuild } from "../actions";
import IndexEntry from "./Entry";
import RebuildIndex from "./Rebuild";

class IndexesList extends React.Component {

    componentDidMount () {
        if (this.props.documents === null) {
            this.props.onFind();
        }
    }

    render () {

        if (this.props.documents === null) {
            return <div />;
        }

        let content;

        if (this.props.totalCount > 0) {
            // Set to true when a ready index has been seen when mapping through the index documents. Used to mark only
            // the newest ready index with a checkmark in the index list.
            let haveSeenReady = false;

            // Render a ListGroupItem for each index version. Mark the first ready index with a checkmark by setting the
            // showReady prop to true.
            let indexComponents = this.props.documents.map(doc => {
                const entry = <IndexEntry key={doc.id} showReady={!doc.ready || !haveSeenReady} {...doc} />;
                haveSeenReady = haveSeenReady || doc.ready;
                return entry;
            });

            if (!indexComponents.length) {
                indexComponents = (
                    <ListGroupItem className="text-center">
                        <p><Icon name="info" /> No indexes have been built</p>
                    </ListGroupItem>
                );
            }

            let alert;

            if (this.props.modifiedCount) {
                let button;

                if (this.props.canRebuild) {
                    button = (
                        <FlexItem pad={20}>
                            <Button bsStyle="warning" icon="hammer" onClick={this.props.showRebuild} pullRight>
                                Rebuild
                            </Button>
                        </FlexItem>
                    );
                }

                alert = (
                    <Alert bsStyle="warning">
                        <Flex alignItems="center">
                            <FlexItem grow={1}>
                                <Flex alignItems="center">
                                    <Icon name="notification" />
                                    <FlexItem pad={10}>
                                        The virus reference database has changed and the index must be rebuilt before
                                        the new information will be included in future analyses.
                                    </FlexItem>
                                </Flex>
                            </FlexItem>
                            {button}
                        </Flex>

                        <RebuildIndex />
                    </Alert>
                );
            }

            content = (
                <div>
                    {alert}

                    <div className="list-group">
                        {indexComponents}
                    </div>
                </div>
            );
        } else {
            content = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="warning" />
                        <FlexItem pad={5}>
                            At least one virus must be added to the database before an index can be built.
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>Virus Indexes</strong>
                </h3>

                {content}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.indexes.documents,
        modifiedCount: state.indexes.modifiedCount,
        totalCount: state.indexes.totalCount,
        canRebuild: state.account.permissions.rebuild_index
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findIndexes());
        },

        showRebuild: () => {
            dispatch(showRebuild());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IndexesList);

export default Container;
