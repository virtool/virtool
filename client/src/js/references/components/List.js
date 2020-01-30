import React from "react";
import { Button } from "react-bootstrap";
import { connect } from "react-redux";
import { LoadingPlaceholder, Panel, ScrollList, ViewHeader } from "../../base";
import { checkAdminOrPermission, routerLocationHasState } from "../../utils/utils";
import { findReferences, remoteReference } from "../actions";
import { getHasOfficial, getTerm } from "../selectors";
import AddReference from "./Add";
import ReferenceItem from "./Item/Item";
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

        let installOfficialComponent;

        if (!this.props.hasOfficial && this.props.canCreate) {
            installOfficialComponent = (
                <Panel key="remote" className="card reference-remote">
                    <span>
                        <p>Official Remote Reference</p>
                        <Button bsStyle="primary" onClick={this.props.onRemote}>
                            Install
                        </Button>
                    </span>
                </Panel>
            );
        }

        return (
            <div>
                <ViewHeader title="References" totalCount={this.props.total_count} />

                <ReferenceToolbar />

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                    page={this.props.page}
                    pageCount={this.props.pageCount}
                    renderRow={this.renderRow}
                />

                {installOfficialComponent}

                <AddReference />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.references,
    term: getTerm(state),
    hasOfficial: getHasOfficial(state),
    showModal: routerLocationHasState(state, "newReference"),
    canCreate: checkAdminOrPermission(state, "create_ref")
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
