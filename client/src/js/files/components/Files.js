import React from "react";
import PropTypes from "prop-types";
import Dropzone from "react-dropzone";
import { push } from "react-router-redux";
import { capitalize, filter } from "lodash";
import { connect } from "react-redux";
import { Col, ListGroup, Row } from "react-bootstrap";

import { byteSize, createRandomString } from "../../utils";
import { findFiles, removeFile, upload, uploadProgress } from "../actions";
import { Button, Icon, ListGroupItem, LoadingPlaceholder, Pagination, RelativeTime, ViewHeader } from "../../base";

const File = (props) => {
    let creation;

    if (props.user === null) {
        creation = (
            <span>
                Retrieved <RelativeTime time={props.uploaded_at} />
            </span>
        );
    } else {
        creation = <span>Uploaded <RelativeTime time={props.uploaded_at} /> by {props.user.id}</span>;
    }

    return (
        <ListGroupItem className="spaced">
            <Row>
                <Col md={5}>
                    <strong>{props.name}</strong>
                </Col>
                <Col md={2}>
                    {byteSize(props.size)}
                </Col>
                <Col md={4}>
                    {creation}
                </Col>
                <Col md={1}>
                    <Icon
                        name="remove"
                        bsStyle="danger"
                        style={{fontSize: "17px"}}
                        pullRight onClick={() => props.onRemove(props.id)}
                    />
                </Col>
            </Row>
        </ListGroupItem>
    );
};

File.propTypes = {
    id: PropTypes.string,
    name: PropTypes.string,
    size: PropTypes.number,
    file: PropTypes.object,
    uploaded_at: PropTypes.string,
    user: PropTypes.object,
    onRemove: PropTypes.func
};

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

const mapStateToProps = (state) => ({...state.files});

const mapDispatchProps = (dispatch) => ({

    onFind: (fileType, page = 1) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
        dispatch(push(url.pathname + url.search));
        dispatch(findFiles(fileType, page));
    },

    onRemove: (fileId) => {
        dispatch(removeFile(fileId));
    },

    onDrop: (fileType, acceptedFiles) => {
        acceptedFiles.forEach(file => {
            const localId = createRandomString();
            dispatch(upload(localId, file, fileType, (e) => dispatch(uploadProgress(localId, e.percent))));
        });
    }

});

const Container = connect(mapStateToProps, mapDispatchProps)(FileManager);

export default Container;
