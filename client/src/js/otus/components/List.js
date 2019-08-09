import { push } from "connected-react-router";
import React from "react";
import { Alert } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Flex, FlexItem, Icon, LoadingPlaceholder, NoneFound, ScrollList } from "../../base";
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
        const { canBuild } = this.props;

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noOTUs;

        if (!this.props.documents.length) {
            noOTUs = <NoneFound noun="otus" />;
        }

        let alert;

        if (this.props.unbuiltChangeCount && canBuild) {
            alert = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="info-circle" />
                        <FlexItem pad={5}>
                            <span>There are unbuilt changes. </span>
                            <Link to={`/refs/${this.props.refId}/indexes`}>Rebuild the index</Link>
                            <span> to use the changes in future analyses.</span>
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        return (
            <div>
                {alert}

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
    unbuiltChangeCount: state.references.detail.unbuilt_change_count,
    refId: state.references.detail.id,
    verified: state.otus.verified,
    canBuild: checkRefRight(state, "build")
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
