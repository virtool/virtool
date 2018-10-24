import React from "react";
import { capitalize, forEach, isEqual } from "lodash-es";
import { connect } from "react-redux";

import { listFiles, upload } from "../actions";
import {
  Alert,
  LoadingPlaceholder,
  NoneFound,
  ViewHeader,
  UploadBar,
  ScrollList
} from "../../base";
import { createRandomString, checkAdminOrPermission } from "../../utils";
import { filesSelector } from "../../listSelectors";
import File from "./File";

class FileManager extends React.Component {
  componentDidMount() {
    if (
      !this.props.fetched ||
      this.props.fileType !== this.props.storedFileType
    ) {
      this.handlePage(1);
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      !isEqual(nextProps.documents, this.props.documents) ||
      !isEqual(nextProps.isLoading, this.props.isLoading) ||
      !isEqual(nextProps.total_count, this.props.total_count)
    );
  }

  handleDrop = acceptedFiles => {
    if (this.props.canUpload) {
      this.props.onDrop(this.props.fileType, acceptedFiles);
    }
  };

  handlePage = page => {
    this.props.onList(this.props.fileType, page);
  };

  rowRenderer = index => (
    <File key={index} index={index} canRemove={this.props.canRemove} />
  );

  render() {
    if (
      this.props.documents === null ||
      (this.props.storedFileType &&
        this.props.fileType !== this.props.storedFileType)
    ) {
      return <LoadingPlaceholder />;
    }

    const titleType =
      this.props.fileType === "reads"
        ? "Read"
        : capitalize(this.props.fileType);

    let toolbar;

    if (this.props.canUpload) {
      toolbar = <UploadBar onDrop={this.handleDrop} />;
    } else {
      toolbar = (
        <Alert bsStyle="warning" icon="exclamation-circle">
          <strong>You do not have permission to upload files.</strong>
          <span> Contact an administrator.</span>
        </Alert>
      );
    }

    return (
      <div>
        <ViewHeader
          title={`${titleType} Files`}
          totalCount={this.props.total_count}
        />

        {toolbar}

        {this.props.documents.length ? null : <NoneFound noun="files" />}

        <ScrollList
          hasNextPage={this.props.page < this.props.page_count}
          isNextPageLoading={this.props.isLoading}
          isLoadError={this.props.errorLoad}
          list={this.props.documents}
          refetchPage={this.props.refetchPage}
          loadNextPage={this.handlePage}
          page={this.props.page}
          rowRenderer={this.rowRenderer}
        />
      </div>
    );
  }
}

const mapStateToProps = state => {
  const {
    found_count,
    page,
    page_count,
    total_count,
    fetched,
    errorLoad,
    isLoading,
    refetchPage
  } = state.files;

  return {
    documents: filesSelector(state),
    found_count,
    page,
    page_count,
    total_count,
    fetched,
    errorLoad,
    isLoading,
    refetchPage,
    canUpload: checkAdminOrPermission(
      state.account.administrator,
      state.account.permissions,
      "upload_file"
    ),
    canRemove: checkAdminOrPermission(
      state.account.administrator,
      state.account.permissions,
      "remove_file"
    ),
    storedFileType: state.files.fileType
  };
};

const mapDispatchToProps = dispatch => ({
  onDrop: (fileType, acceptedFiles) => {
    forEach(acceptedFiles, file => {
      const localId = createRandomString();
      dispatch(upload(localId, file, fileType));
    });
  },

  onList: (fileType, page = 1) => {
    dispatch(listFiles(fileType, page));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(FileManager);
