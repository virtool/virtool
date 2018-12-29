import React from "react";
import { connect } from "react-redux";
import { Panel, Button } from "react-bootstrap";
import { remoteReference, findReferences } from "../actions";
import { ViewHeader, LoadingPlaceholder, NoneFound, ScrollList } from "../../base";
import { checkAdminOrPermission, routerLocationHasState } from "../../utils/utils";
import { getHasOfficial, getTerm } from "../selectors";
import AddReference from "./Add";
import ReferenceItem from "./Item";
import ReferenceToolbar from "./Toolbar";

class ReferenceList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    renderRow = index => <ReferenceItem key={this.props.documents[index].id} {...this.props.documents[index]} />;

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let referenceComponents = null;
        let noRefs;

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

        if (this.props.documents.length) {
            referenceComponents = (
                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                    page={this.props.page}
                    pageCount={this.props.pageCount}
                    renderRow={this.renderRow}
                    noContainer
                />
            );
        } else if (!installOfficialComponent) {
            noRefs = <NoneFound noun="References" />;
        }

        return (
            <div>
                <ViewHeader title="References" totalCount={this.props.total_count} />

                <ReferenceToolbar />

                <div className="card-container">
                    {referenceComponents}
                    {installOfficialComponent}
                </div>

                {noRefs}

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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceList);
