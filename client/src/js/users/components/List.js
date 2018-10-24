/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UsersList
 */
import React from "react";
import { connect } from "react-redux";
import { isEqual } from "lodash-es";
import { ScrollList } from "../../base";
import { listUsers } from "../actions";
import { usersSelector } from "../../listSelectors";
import UserEntry from "./Entry";

class UsersList extends React.Component {
  componentDidMount() {
    if (!this.props.fetched) {
      this.props.loadNextPage(1);
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      !isEqual(nextProps.documents, this.props.documents) ||
      !isEqual(nextProps.isLoading, this.props.isLoading)
    );
  }

  rowRenderer = index => <UserEntry key={index} index={index} />;

  render() {
    return (
      <ScrollList
        hasNextPage={this.props.page < this.props.page_count}
        isNextPageLoading={this.props.isLoading}
        isLoadError={this.props.errorLoad}
        list={this.props.documents}
        refetchPage={this.props.refetchPage}
        loadNextPage={this.props.loadNextPage}
        page={this.props.page}
        rowRenderer={this.rowRenderer}
      />
    );
  }
}

const mapStateToProps = state => {
  const { documents, page, page_count } = usersSelector(state);

  return {
    documents,
    page,
    page_count,
    fetched: state.users.fetched,
    refetchPage: state.users.refetchPage,
    isLoading: state.users.isLoading,
    errorLoad: state.users.errorLoad
  };
};

const mapDispatchToProps = dispatch => ({
  loadNextPage: page => {
    if (page) {
      dispatch(listUsers(page));
    }
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(UsersList);
