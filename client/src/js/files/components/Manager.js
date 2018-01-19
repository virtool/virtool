import React from "react";
import Dropzone from "react-dropzone";
import { push } from "react-router-redux";
import { capitalize, filter } from "lodash";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";

import File from "./File";
import { createRandomString } from "../../utils";
import { findFiles, removeFile, upload, uploadProgress } from "../actions";
import { Button, Icon, ListGroupItem, LoadingPlaceholder, Pagination, ViewHeader } from "../../base";

class FileManager extends React.Component {

    componentDidMount () {
        this.props.onFind(this.props.fileType);
    }

    handleDrop = (acceptedFiles) => {
        this.props.onDrop(this.props.fileType, acceptedFiles);
    };

    handlePage = (page) => {
        this.props.onFind(this.props.fileType, page);
    };

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let fileComponents = filter(this.props.documents, {type: this.props.fileType}).map(document =>
            <File
                key={document.id}
                {...document}
                onRemove={this.props.onRemove}
            />
        );

        if (!fileComponents.length) {
            fileComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No files found
                </ListGroupItem>
            );
        }

        const titleType = this.props.fileType === "reads" ? "Read" : capitalize(this.props.fileType);

        return (
            <div>
                <ViewHeader
                    title={`${titleType} Files`}
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

                <div className="toolbar">
                    <Dropzone
                        ref={(node) => this.dropzone = node}
                        onDrop={this.handleDrop}
                        className="dropzone"
                        activeClassName="dropzone-active"
                        disableClick
                    >
                        Drag file here to upload
                    </Dropzone>

                    <Button icon="folder-open" onClick={() => this.dropzone.open()}/>
                </div>

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
    const { documents, page, found_count, total_count } = state.files;

    return {
        documents,
        page,
        found_count,
        total_count
    };
};

const mapDispatchToProps = (dispatch) => ({

    onDrop: (fileType, acceptedFiles) => {
        acceptedFiles.forEach(file => {
            const localId = createRandomString();
            dispatch(upload(localId, file, fileType, (e) => dispatch(uploadProgress(localId, e.percent))));
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

const Container = connect(mapStateToProps, mapDispatchToProps)(FileManager);

export default Container;
