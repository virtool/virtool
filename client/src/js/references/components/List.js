import React from "react";
import { connect } from "react-redux";
import { Badge, LoadingPlaceholder, ScrollList, ViewHeader, ViewHeaderTitle } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import { findReferences, remoteReference } from "../actions";
import { getTerm } from "../selectors";
import AddReference from "./Add";
import ReferenceItem from "./Item/Item";
import ReferenceOfficial from "./Official";
import ReferenceToolbar from "./Toolbar";

class ReferenceList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    renderRow = index => <ReferenceItem key={this.props.documents[index].id} index={index} />;

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        return (
            <div>
                <ViewHeader title="References">
                    <ViewHeaderTitle>
                        References <Badge>{this.props.total_count}</Badge>
                    </ViewHeaderTitle>
                </ViewHeader>

                <ReferenceToolbar />
                <ReferenceOfficial />

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                    page={this.props.page}
                    pageCount={this.props.pageCount}
                    renderRow={this.renderRow}
                />

                <AddReference />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.references,
    term: getTerm(state),
    showModal: routerLocationHasState(state, "newReference")
});

const mapDispatchToProps = dispatch => ({
    onRemote: () => {
        dispatch(remoteReference());
    },

    onLoadNextPage: (term, page) => {
        dispatch(findReferences(term, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceList);
