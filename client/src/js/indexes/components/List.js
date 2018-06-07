import React from "react";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { checkUserRefPermission, getUpdatedScrollListState } from "../../utils";
import { Button, Flex, FlexItem, Icon, LoadingPlaceholder, NoneFound, ScrollList } from "../../base";
import { findIndexes } from "../actions";
import IndexEntry from "./Entry";
import RebuildIndex from "./Rebuild";

class IndexesList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page
        };

        this.firstReady = false;
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        return getUpdatedScrollListState(nextProps, prevState);
    }

    handleNextPage = (page) => {
        this.props.loadNextPage(this.props.refId, page);
    };

    rowRenderer = (index) => {

        let isActive = false;

        if (!this.firstReady && this.state.masterList[index].ready) {
            isActive = true;
            this.firstReady = true;
        }

        return (
            <IndexEntry
                key={this.state.masterList[index].id}
                showReady={!this.state.masterList[index].ready || isActive}
                {...this.state.masterList[index]}
                refId={this.props.refId}
            />
        );
    };

    render () {

        if (this.props.documents === null ||
                (this.props.documents.length &&
                    this.props.documents[0].reference.id !== this.props.refId)) {
            return <LoadingPlaceholder />;
        }

        let noIndexes;
        let alert;

        if (!this.state.masterList.length) {
            noIndexes = <NoneFound noun="indexes" />;
        }

        if (this.props.total_otu_count) {

            const hasBuildPermission = checkUserRefPermission(this.props, "build");

            if (this.props.modified_otu_count) {
                const button = hasBuildPermission ? (
                    <FlexItem pad={20}>
                        <LinkContainer to={{state: {rebuild: true}}}>
                            <Button bsStyle="warning" icon="hammer" pullRight>
                                Rebuild
                            </Button>
                        </LinkContainer>
                    </FlexItem>
                ) : null;

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

        } else {
            alert = (
                <Alert bsStyle="warning" icon="warning">
                    At least one OTU must be added to the database before an index can be built.
                </Alert>
            );
        }

        return (
            <div>
                {alert}
                {noIndexes}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.state.masterList}
                    loadNextPage={this.handleNextPage}
                    page={this.state.page}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.indexes,
    refId: state.references.detail.id,
    isAdmin: state.account.administrator,
    userId: state.account.id,
    userGroups: state.account.groups,
    detail: state.references.detail
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (refId, page) => {
        dispatch(findIndexes(refId, page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IndexesList);
