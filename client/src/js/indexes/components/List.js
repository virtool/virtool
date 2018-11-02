import React from "react";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { checkRefRight } from "../../utils/utils";
import { Button, Flex, FlexItem, Icon, LoadingPlaceholder, NoneFound, ScrollList } from "../../base";
import { findIndexes } from "../actions";
import IndexEntry from "./Item";
import RebuildIndex from "./Rebuild";

class IndexesList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.detail.id, 1);
    }

    renderRow = index => <IndexEntry key={index} index={index} />;

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noIndexes;
        let alert;

        if (!this.props.documents.length) {
            noIndexes = <NoneFound noun="indexes" />;
        }

        if (this.props.total_otu_count) {
            if (this.props.modified_otu_count) {
                const button = this.props.canBuild ? (
                    <FlexItem pad={20}>
                        <LinkContainer to={{ state: { rebuild: true } }}>
                            <Button bsStyle="warning" icon="wrench" pullRight>
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
                                        The reference has unbuilt changes. A new index must be built before the
                                        information will be included in future analyses.
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
                <Alert bsStyle="warning" icon="exclamation-circle">
                    At least one OTU must be added to the database before an index can be built.
                </Alert>
            );
        }

        return (
            <div>
                {alert}
                {noIndexes}

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={this.props.onLoadNextPage}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    renderRow={this.renderRow}
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.indexes,
    detail: state.references.detail,
    canBuild: checkRefRight(state, "build")
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (refId, page) => {
        dispatch(findIndexes(refId, null, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(IndexesList);
