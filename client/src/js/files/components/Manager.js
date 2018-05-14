import React from "react";
import { capitalize, filter, forEach, map } from "lodash-es";
import { ListGroup } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";

import File from "./File";
import { findFiles, removeFile, upload } from "../actions";
import { Alert, LoadingPlaceholder, NoneFound, Pagination, ViewHeader, UploadBar } from "../../base";
import { createRandomString, checkAdminOrPermission } from "../../utils";

class FileManager extends React.Component {

    componentDidMount () {
        this.props.onFind(this.props.fileType);
    }

    handleDrop = (acceptedFiles) => {
        if (this.props.canUpload) {
            this.props.onDrop(this.props.fileType, acceptedFiles);
        }
    };

    handlePage = (page) => {
        this.props.onFind(this.props.fileType, page);
    };

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        const filtered = filter(this.props.documents, {type: this.props.fileType});

        let fileComponents;

        if (filtered.length) {
            fileComponents = map(filtered, document =>
                <File key={document.id} {...document} onRemove={this.props.onRemove} />
            );
        } else {
            fileComponents = (
                <NoneFound noun="files" />
            );
        }

        const titleType = this.props.fileType === "reads" ? "Read" : capitalize(this.props.fileType);

        let toolbar;

        if (this.props.canUpload) {
            toolbar = (
                <UploadBar onDrop={this.handleDrop} />
            );
        } else {
            toolbar = (
                <Alert bsStyle="warning" icon="warning">
                    <strong>You do not have permission to upload files.</strong>
                    <span>Contact an administrator.</span>
                </Alert>
            );
        }

        return (
            <div>
                <ViewHeader
                    title={`${titleType} Files`}
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

                {toolbar}

                <ListGroup>
                    {fileComponents}
                </ListGroup>

                <Pagination
                    documentCount={this.props.documents.length}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    onPage={this.handlePage}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { documents, found_count, page, page_count, total_count } = state.files;

    return {
        documents,
        found_count,
        page,
        page_count,
        total_count,
        canUpload: checkAdminOrPermission(state.account.administrator, state.account.permissions, "upload_file")
    };
};

const mapDispatchToProps = (dispatch) => ({

    onDrop: (fileType, acceptedFiles) => {
        forEach(acceptedFiles, file => {
            const localId = createRandomString();
            dispatch(upload(localId, file, fileType));
        });
    },

    onFind: (fileType, page = 1) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
        dispatch(push(url.pathname + url.search));
        dispatch(findFiles(fileType, page));
    },

    onRemove: (fileId) => {
        dispatch(removeFile(fileId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(FileManager);
