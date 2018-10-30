import React from "react";
import { capitalize, forEach } from "lodash-es";
import { connect } from "react-redux";

import { findFiles, upload } from "../actions";
import { Alert, LoadingPlaceholder, NoneFound, ViewHeader, UploadBar, ScrollList } from "../../base";
import { createRandomString, checkAdminOrPermission } from "../../utils";
import { filesSelector } from "../../listSelectors";
import File from "./File";

class FileManager extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.fileType, this.props.term, 1);
    }

    handleDrop = acceptedFiles => {
        if (this.props.canUpload) {
            this.props.onDrop(this.props.fileType, acceptedFiles);
        }
    };

    renderRow = index => <File key={index} index={index} canRemove={this.props.canRemove} />;

    render() {
        if (
            this.props.documents === null ||
            (this.props.storedFileType && this.props.fileType !== this.props.storedFileType)
        ) {
            return <LoadingPlaceholder />;
        }

        const titleType = this.props.fileType === "reads" ? "Read" : capitalize(this.props.fileType);

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
                <ViewHeader title={`${titleType} Files`} totalCount={this.props.total_count} />

                {toolbar}

                {this.props.documents.length ? null : <NoneFound noun="files" />}

                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.fileType, this.props.term, page)}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    renderRow={this.renderRow}
                />
            </div>
        );
    }
}

const mapStateToProps = state => {
    const { found_count, page, page_count, total_count } = state.files;

    return {
        documents: filesSelector(state),
        found_count,
        page,
        page_count,
        total_count,
        canUpload: checkAdminOrPermission(state, "upload_file"),
        canRemove: checkAdminOrPermission(state, "remove_file"),
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

    onLoadNextPage: (fileType, term, page = 1) => {
        dispatch(findFiles(fileType, term, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(FileManager);
