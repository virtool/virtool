import React from "react";
import { Button } from "react-bootstrap";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, Box, LoadingPlaceholder, ScrollList, ViewHeader, ViewHeaderTitle } from "../../base";
import { checkAdminOrPermission, routerLocationHasState } from "../../utils/utils";
import { findReferences, remoteReference } from "../actions";
import { getHasOfficial, getTerm } from "../selectors";
import AddReference from "./Add";
import ReferenceItem from "./Item/Item";
import ReferenceToolbar from "./Toolbar";

const OfficialReferencePlaceholder = styled(Box)`
    align-items: center;
    display: flex;
    flex-direction: column;
    height: 180px;
    justify-content: center;
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

        let installOfficialComponent;

        if (!this.props.hasOfficial && this.props.canCreate) {
            installOfficialComponent = (
                <OfficialReferencePlaceholder key="remote">
                    <p>Official Remote Reference</p>
                    <Button bsStyle="primary" onClick={this.props.onRemote}>
                        Install
                    </Button>
                </OfficialReferencePlaceholder>
            );
        }

        return (
            <div>
                <ViewHeader title="References">
                    <ViewHeaderTitle>
                        References <Badge>{this.props.total_count}</Badge>
                    </ViewHeaderTitle>
                </ViewHeader>

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
