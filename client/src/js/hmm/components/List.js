import React from "react";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";
import { connect } from "react-redux";
import {
  Icon,
  LoadingPlaceholder,
  ViewHeader,
  ScrollList,
  NoneFound
} from "../../base";
import { findHmms } from "../actions";
import HMMItem from "./Item";
import HMMInstaller from "./Installer";

class HMMList extends React.Component {
  componentDidMount() {
    if (!this.props.fetched) {
      this.props.loadNextPage(1);
    }
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.status &&
      !prevProps.status.installed &&
      this.props.status.installed
    ) {
      this.props.loadNextPage(1);
    }
  }

  rowRenderer = index => (
    <HMMItem
      key={this.props.documents[index].id}
      {...this.props.documents[index]}
    />
  );

  render() {
    if (this.props.documents === null) {
      return <LoadingPlaceholder />;
    }

    if (this.props.status.installed) {
      return (
        <div>
          <ViewHeader title="HMMs" totalCount={this.props.found_count} />

          <FormGroup>
            <InputGroup>
              <InputGroup.Addon>
                <Icon name="search" />
              </InputGroup.Addon>

              <FormControl
                type="text"
                placeholder="Definition"
                onChange={this.props.onFilter}
                value={this.props.filter}
              />
            </InputGroup>
          </FormGroup>

          {this.props.documents.length ? (
            <ScrollList
              hasNextPage={this.props.page < this.props.page_count}
              isNextPageLoading={this.props.isLoading}
              isLoadError={this.props.errorLoad}
              list={this.props.documents}
              loadNextPage={this.props.loadNextPage}
              page={this.props.page}
              rowRenderer={this.rowRenderer}
            />
          ) : (
            <NoneFound noun="HMMs" />
          )}
        </div>
      );
    }

    return (
      <div>
        <h3 className="view-header">
          <strong>HMMs</strong>
        </h3>
        <HMMInstaller />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  ...state.hmms,
  filter: state.hmms.filter
});

const mapDispatchToProps = dispatch => ({
  onFind: e => {
    dispatch(findHmms(e.target.value));
  },

  loadNextPage: page => {
    dispatch(listHmms(page));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(HMMList);
