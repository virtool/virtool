import React from "react";
import { Button } from "react-bootstrap";
import { connect } from "react-redux";
import styled from "styled-components";
import { LoadingPlaceholder, NoneFound, Panel, ScrollList, ViewHeader } from "../../base";
import { checkAdminOrPermission, routerLocationHasState } from "../../utils/utils";
import { findReferences, remoteReference } from "../actions";
import { getHasOfficial, getTerm } from "../selectors";
import AddReference from "./Add";
import ReferenceItem from "./Item/Item";
import ReferenceToolbar from "./Toolbar";

const ReferenceListContainer = styled.div`
    display: grid;
    grid-auto-rows: 1fr;
    grid-gap: 0 15px;
    grid-template-columns: 1fr;

    @media (min-width: 764px) {
        grid-template-columns: 1fr 1fr;
    }

    @media (min-width: 992px) {
        grid-template-columns: 1fr 1fr 1fr;
    }

    @media (min-width: 1420px) {
        grid-template-columns: 1fr 1fr 1fr 1fr;
    }
`;

class ReferenceList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    renderRow = index => <ReferenceItem key={this.props.documents[index].id} index={index} />;

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

                <ReferenceListContainer>
                    {referenceComponents}
                    {installOfficialComponent}
                </ReferenceListContainer>

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
