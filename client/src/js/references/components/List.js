import React from "react";
import { connect } from "react-redux";
import { Panel, Button } from "react-bootstrap";
import { remoteReference, listReferences } from "../actions";
import {
  ViewHeader,
  LoadingPlaceholder,
  NoneFound,
  ScrollList
} from "../../base";
import { checkAdminOrPermission } from "../../utils";
import AddReference from "./AddReference";
import ReferenceItem from "./ReferenceItem";
import ReferenceToolbar from "./Toolbar";

class ReferenceList extends React.Component {
  componentDidMount() {
    if (!this.props.fetched) {
      this.props.loadNextPage(1);
    }
  }

  rowRenderer = index => (
    <ReferenceItem
      key={this.props.documents[index].id}
      {...this.props.documents[index]}
    />
  );

  render() {
    if (this.props.documents === null) {
      return <LoadingPlaceholder />;
    }

    let referenceComponents = null;
    let noRefs;

    if (this.props.documents.length) {
      referenceComponents = (
        <ScrollList
          hasNextPage={this.props.page < this.props.page_count}
          isNextPageLoading={this.props.isLoading}
          isLoadError={this.props.errorLoad}
          list={this.props.documents}
          refetchPage={this.props.refetchPage}
          loadNextPage={this.props.loadNextPage}
          page={this.props.page}
          rowRenderer={this.rowRenderer}
          noContainer
        />
      );
    } else {
      noRefs = <NoneFound noun="References" />;
    }

    const officialRemote =
      !this.props.installOfficial && this.props.canCreateRef ? (
        <Panel key="remote" className="card reference-remote">
          <span>
            <p>Official Remote Reference</p>
            <Button bsStyle="primary" onClick={this.props.onRemote}>
              Install
            </Button>
          </span>
        </Panel>
      ) : null;

    return (
      <div>
        <ViewHeader title="References" totalCount={this.props.total_count} />

        <ReferenceToolbar canCreate={this.props.canCreateRef} />

        <div className="card-container">
          {referenceComponents}
          {officialRemote}
        </div>

        {officialRemote ? null : noRefs}

        {this.props.routerStateExists ? <AddReference /> : null}
      </div>
    );
  }
}

const mapStateToProps = state => ({
  ...state.references,
  account: state.account,
  routerStateExists: !!state.router.location.state,
  canCreateRef: checkAdminOrPermission(
    state.account.administrator,
    state.account.permissions,
    "create_ref"
  )
});

const mapDispatchToProps = dispatch => ({
  onRemote: () => {
    dispatch(remoteReference());
  },

  loadNextPage: page => {
    dispatch(listReferences(page));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ReferenceList);
