import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { LoadingPlaceholder, NarrowContainer, NoneFoundBox, ScrollList } from "../../base";
import RebuildAlert from "../../indexes/components/RebuildAlert";
import { findOTUs } from "../actions";
import { getTerm } from "../selectors";
import CreateOTU from "./Create";
import OTUItem from "./Item";
import OTUToolbar from "./Toolbar";

export class OTUsList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.refId, this.props.term, this.props.verified, 1);
    }

    renderRow = index => <OTUItem key={index} index={index} />;

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noneFound;

        if (!this.props.documents.length) {
            noneFound = <NoneFoundBox noun="OTUs" />;
        }

        return (
            <NarrowContainer>
                <RebuildAlert />
                <OTUToolbar />
                <CreateOTU {...this.props} />

                {noneFound}

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page =>
                        this.props.onLoadNextPage(this.props.refId, this.props.term, this.props.verified, page)
                    }
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    renderRow={this.renderRow}
                />
            </NarrowContainer>
        );
    }
}

export const mapStateToProps = state => ({
    ...state.otus,
    term: getTerm(state),
    refId: state.references.detail.id,
    verified: state.otus.verified
});

export const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ createOTU: false }));
    },

    onLoadNextPage: (refId, term, verified, page) => {
        dispatch(findOTUs(refId, term, verified, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUsList);
