import React from "react";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { checkUserRefPermission } from "../../utils";
import {
  Button,
  Flex,
  FlexItem,
  Icon,
  LoadingPlaceholder,
  NoneFound,
  ScrollList
} from "../../base";
import { listIndexes } from "../actions";
import IndexEntry from "./Entry";
import RebuildIndex from "./Rebuild";

class IndexesList extends React.Component {
  constructor(props) {
    super(props);
    this.firstReady = false;
  }

  componentDidMount() {
    if (!this.props.fetched || this.props.refId !== this.props.referenceId) {
      this.handleNextPage(1);
    }
  }

  handleNextPage = page => {
    this.props.onList(this.props.refId, page);
  };

  rowRenderer = index => {
    let isActive = false;

    if (!this.firstReady && this.props.documents[index].ready) {
      isActive = true;
      this.firstReady = true;
    }

    return (
      <IndexEntry
        key={this.props.documents[index].id}
        showReady={!this.props.documents[index].ready || isActive}
        {...this.props.documents[index]}
        refId={this.props.refId}
      />
    );
  };

  render() {
    if (
      this.props.documents === null ||
      this.props.refId !== this.props.referenceId
    ) {
      return <LoadingPlaceholder />;
    }

    this.firstReady = false;

    let noIndexes;
    let alert;

    if (!this.props.documents.length) {
      noIndexes = <NoneFound noun="indexes" />;
    }

    if (this.props.total_otu_count) {
      const hasBuildPermission = checkUserRefPermission(this.props, "build");

      if (this.props.modified_otu_count) {
        const button = hasBuildPermission ? (
          <FlexItem pad={20}>
            <LinkContainer to={{ state: { rebuild: true } }}>
              <Button bsStyle="warning" icon="wrench" pullRight>
                Rebuild
              </Button>
            </LinkContainer>
          </FlexItem>
        ) : null;

        alert = (
          <Alert bsStyle="warning">
            <Flex alignItems="center">
              <FlexItem grow={1}>
                <Flex alignItems="center">
                  <Icon name="exclamation-circle" />
                  <FlexItem pad={10}>
                    The reference has unbuilt changes. A new index must be built
                    before the information will be included in future analyses.
                  </FlexItem>
                </Flex>
              </FlexItem>
              {button}
            </Flex>

            <RebuildIndex />
          </Alert>
        );
      }
    } else {
      alert = (
        <Alert bsStyle="warning" icon="exclamation-circle">
          At least one OTU must be added to the database before an index can be
          built.
        </Alert>
      );
    }

    return (
      <div>
        {alert}
        {noIndexes}

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
  ...state.indexes,
  refId: state.references.detail.id,
  isAdmin: state.account.administrator,
  userId: state.account.id,
  userGroups: state.account.groups,
  detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({
  onList: (refId, page) => {
    dispatch(listIndexes(refId, page));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(IndexesList);
