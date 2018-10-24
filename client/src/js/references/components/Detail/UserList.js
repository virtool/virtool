import React from "react";
import { connect } from "react-redux";
import { ScrollList } from "../../../base";
import { listUsers } from "../../../users/actions";
import MemberEntry from "./MemberEntry";

class UsersList extends React.Component {
  constructor(props) {
    super(props);
    this.scrollContainer = React.createRef();
  }

  componentDidMount() {
    if (!this.props.fetched) {
      this.props.loadNextPage(1);
    }
  }

  rowRenderer = index => {
    const isSelected = this.props.selected === this.props.documents[index].id;
    return (
      <MemberEntry
        key={this.props.documents[index].id}
        onEdit={this.props.onEdit}
        onToggleSelect={this.props.onToggleSelect}
        add={isSelected}
        id={this.props.documents[index].id}
        identicon={this.props.documents[index].identicon}
        permissions={
          isSelected
            ? {
                build: this.props.permissions.build,
                modify: this.props.permissions.modify,
                modify_otu: this.props.permissions.modify_otu,
                remove: this.props.permissions.remove
              }
            : {
                build: this.props.documents[index].build,
                modify: this.props.documents[index].modify,
                modify_otu: this.props.documents[index].modify_otu,
                remove: this.props.documents[index].remove
              }
        }
        isSelected={isSelected}
      />
    );
  };

  render() {
    return (
      <ScrollList
        ref={this.scrollContainer}
        hasNextPage={this.props.page < this.props.page_count}
        isNextPageLoading={this.props.isLoading}
        isLoadError={this.props.errorLoad}
        list={this.props.documents}
        refetchPage={this.props.refetchPage}
        loadNextPage={this.props.loadNextPage}
        page={this.props.page}
        rowRenderer={this.rowRenderer}
        style={{ height: "300px", overflowY: "auto", padding: "15px" }}
        isElement
      />
    );
  }
}

const mapStateToProps = state => ({
  page: state.users.list.page,
  page_count: state.users.list.page_count,
  errorLoad: state.users.errorLoad,
  isLoading: state.users.isLoading,
  refetchPage: state.users.refetchPage
});

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
