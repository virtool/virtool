import { push } from "connected-react-router";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Icon, LoadingPlaceholder, NoneFound, ScrollList, WarningAlert } from "../../base";
import RebuildAlert from "../../indexes/components/RebuildAlert";
import { checkRefRight } from "../../utils/utils";
import { findOTUs } from "../actions";
import { getTerm } from "../selectors";
import CreateOTU from "./Create";
import OTUItem from "./Item";
import OTUToolbar from "./Toolbar";

class OTUsList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.refId, this.props.term, this.props.verified, 1);
    }

    renderRow = index => <OTUItem key={index} index={index} />;

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noOTUs;

        if (!this.props.documents.length) {
            noOTUs = <NoneFound noun="otus" />;
        }

        return (
            <div>
                <RebuildAlert />
                <OTUToolbar />
                <CreateOTU {...this.props} />

                {noOTUs}

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page =>
                        this.props.onLoadNextPage(this.props.refId, this.props.term, this.props.verified, page)
                    }
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    renderRow={this.renderRow}
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.otus,
    term: getTerm(state),
    refId: state.references.detail.id,
    verified: state.otus.verified
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(push({ state: { createOTU: false } }));
    },

    onLoadNextPage: (refId, term, verified, page) => {
        dispatch(findOTUs(refId, term, verified, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(OTUsList);
