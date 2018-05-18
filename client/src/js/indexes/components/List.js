import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { Button, Flex, FlexItem, Icon, LoadingPlaceholder, NoneFound, ViewHeader } from "../../base";
import { findIndexes } from "../actions";
import IndexEntry from "./Entry";
import RebuildIndex from "./Rebuild";

class IndexesList extends React.Component {

    componentDidMount () {
        this.props.onFind();
    }

    render () {

        if (this.props.documents === null ) {
            return <LoadingPlaceholder />;
        }

        const refId = this.props.documents[0].reference.id;

        let content;

        if (this.props.total_otu_count) {
            // Set to true when a ready index has been seen when mapping through the index documents. Used to mark only
            // the newest ready index with a checkmark in the index list.
            let haveSeenReady = false;

            let indexComponents;

            if (this.props.documents.length) {
                // Render a ListGroupItem for each index version. Mark the first ready index with a checkmark by setting
                // the showReady prop to true.
                indexComponents = map(this.props.documents, doc => {
                    const entry = <IndexEntry key={doc.id} showReady={!doc.ready || !haveSeenReady} {...doc} refId={refId} />;
                    haveSeenReady = haveSeenReady || doc.ready;
                    return entry;
                });
            } else {
                indexComponents = <NoneFound noun="indexes" noListGroup />;
            }

            let alert;

            if (this.props.modified_otu_count) {
                const button = (
                    <FlexItem pad={20}>
                        <LinkContainer to={{state: {rebuild: true}}}>
                            <Button bsStyle="warning" icon="hammer" pullRight>
                                Rebuild
                            </Button>
                        </LinkContainer>
                    </FlexItem>
                );

                alert = (
                    <Alert bsStyle="warning">
                        <Flex alignItems="center">
                            <FlexItem grow={1}>
                                <Flex alignItems="center">
                                    <Icon name="exclamation-circle" />
                                    <FlexItem pad={10}>
                                        The OTU reference database has changed and the index must be rebuilt before
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
                <Alert bsStyle="warning" icon="warning">
                    At least one OTU must be added to the database before an index can be built.
                </Alert>
            );
        }

        return (
            <div>
                <ViewHeader
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                />

                {content}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.indexes
});

const mapDispatchToProps = (dispatch) => ({

    onFind: () => {
        dispatch(findIndexes());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IndexesList);
