import React from "react";
import { isEqual } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { Alert } from "react-bootstrap";
import {
  Flex,
  FlexItem,
  Icon,
  LoadingPlaceholder,
  ScrollList,
  NoneFound
} from "../../base";
import { checkUserRefPermission } from "../../utils";
import { otusSelector } from "../../listSelectors";
import { listOTUs } from "../actions";
import OTUToolbar from "./Toolbar";
import OTUItem from "./Item";
import CreateOTU from "./Create";

class OTUsList extends React.Component {
  componentDidMount() {
    if (!this.props.fetched) {
      this.props.loadNextPage(this.props.refId, 1);
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      !isEqual(nextProps.documents, this.props.documents) ||
      !isEqual(nextProps.isLoading, this.props.isLoading) ||
      !isEqual(nextProps.unbuiltChangeCount, this.props.unbuiltChangeCount)
    );
  }

  handleNextPage = page => {
    this.props.loadNextPage(this.props.refId, page);
  };

  rowRenderer = index => (
    <OTUItem key={index} refId={this.props.refId} index={index} />
  );

  render() {
    if (this.props.documents === null) {
      return <LoadingPlaceholder />;
    }

    let noOTUs;

    if (!this.props.documents.length) {
      noOTUs = <NoneFound noun="otus" />;
    }

    const hasBuild = checkUserRefPermission(this.props, "build");
    const hasRemoveOTU = checkUserRefPermission(this.props, "modify_otu");

    let alert;

    if (this.props.unbuiltChangeCount && hasBuild) {
      alert = (
        <Alert bsStyle="warning">
          <Flex alignItems="center">
            <Icon name="info-circle" />
            <FlexItem pad={5}>
              <span>There are unbuilt changes. </span>
              <Link to={`/refs/${this.props.refId}/indexes`}>
                Rebuild the index
              </Link>
              <span> to use the changes in future analyses.</span>
            </FlexItem>
          </Flex>
        </Alert>
      );
    }

    return (
      <div>
        {alert}

        <OTUToolbar hasRemoveOTU={hasRemoveOTU} refId={this.props.refId} />

        <CreateOTU {...this.props} />

        {noOTUs}

        <ScrollList
          hasNextPage={this.props.page < this.props.page_count}
          isNextPageLoading={this.props.isLoading}
          isLoadError={this.props.errorLoad}
          list={this.props.documents}
          refetchPage={this.props.refetchPage}
          loadNextPage={this.handleNextPage}
          page={this.props.page}
          rowRenderer={this.rowRenderer}
        />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  ...state.otus,
  documents: otusSelector(state),
  refId: state.references.detail.id,
  unbuiltChangeCount: state.references.detail.unbuilt_change_count,
  isAdmin: state.account.administrator,
  userId: state.account.id,
  userGroups: state.account.groups,
  detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({
  onHide: () => {
    dispatch(push({ state: { createOTU: false } }));
  },

  loadNextPage: (refId, page) => {
    dispatch(listOTUs(refId, page));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(OTUsList);
