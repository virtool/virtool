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

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";

import { Flex, FlexItem, Icon } from "virtool/js/components/Base";
import { findIndexes, createIndex } from "../actions";
import IndexEntry from "./Entry";
import { RebuildIndex } from "./Rebuild";

class Indexes extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object),
        totalCount: PropTypes.number,
        modifiedCount: PropTypes.number,

        onFind: PropTypes.func,
        onCreate: PropTypes.func
    };

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
            const indexComponents = this.props.documents.map(doc => {
                const entry = <IndexEntry key={doc.index_id} showReady={!doc.ready || !haveSeenReady} {...doc} />;

                if (doc.ready) {
                    haveSeenReady = true;
                }

                return entry;
            });

            content = (
                <div>
                    <RebuildIndex
                        canRebuild={this.props.canRebuild}
                        modifiedCount={this.props.modifiedCount}
                        rebuild={this.props.onCreate}
                    />

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

        onCreate: () => {
            dispatch(createIndex());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Indexes);

export default Container;
