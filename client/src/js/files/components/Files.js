import React from "react";
import PropTypes from "prop-types";
import { capitalize, filter } from "lodash";
import { connect } from "react-redux";
import Dropzone from "react-dropzone";
import { Badge, Col, ListGroup, Pagination, Row } from "react-bootstrap";

import { byteSize, createRandomString } from "../../utils";
import { findFiles, removeFile, upload, uploadProgress } from "../actions";
import { Button, Flex, FlexItem, Icon, ListGroupItem, PageHint, RelativeTime } from "../../base";

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

    render () {
        if (this.props.documents === null) {
            return <div />;
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

        const titleType = this.props.fileType === "reads" ? "Read": capitalize(this.props.fileType);

        return (
            <div>
                <h3 className="view-header">
                    <Flex alignItems="flex-end">
                        <FlexItem grow={0} shrink={0}>
                            <strong>{titleType} Files</strong> <Badge>{this.props.totalCount}</Badge>
                        </FlexItem>
                        <FlexItem grow={1} shrink={0}>
                            <PageHint
                                page={this.props.page}
                                count={this.props.documents.length}
                                totalCount={this.props.totalCount}
                                perPage={this.props.perPage}
                                pullRight
                            />
                        </FlexItem>
                    </Flex>

                </h3>

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

                {this.props.pageCount > 1 ? (
                    <div className="text-center">
                        <Pagination
                            items={this.props.pageCount}
                            maxButtons={10}
                            activePage={this.props.page}
                            onSelect={this.handlePage}
                            first
                            last
                            next
                            prev
                        />
                    </div>
                ): null}
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.files.documents,
        page: state.files.page,
        pageCount: state.files.pageCount,
        perPage: state.files.perPage,
        totalCount: state.files.totalCount
    };
};

const mapDispatchProps = (dispatch) => {
    return {
        onFind: (fileType) => {
            dispatch(findFiles(fileType));
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
    };
};

const Container = connect(mapStateToProps, mapDispatchProps)(FileManager);

export default Container;
