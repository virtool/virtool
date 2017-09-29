import React from "react";
import PropTypes from "prop-types";
import { capitalize, filter } from "lodash";
import { connect } from "react-redux";
import Dropzone from "react-dropzone";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { byteSize } from "virtool/js/utils";
import { createRandomString } from "../../utils";
import { findFiles, removeFile, upload, uploadProgress } from "../actions";
import { Button, Icon, ListGroupItem, RelativeTime } from "virtool/js/components/Base";

const File = (props) => (
    <ListGroupItem className="spaced">
        <Row>
            <Col md={5}>
                {props.name}
            </Col>
            <Col md={2}>
                {byteSize(props.size)}
            </Col>
            <Col md={4}>
                Uploaded <RelativeTime time={props.uploaded_at} /> by {props.user.id}
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

    static propTypes = {
        fileType: PropTypes.string.isRequired,
        documents: PropTypes.arrayOf(PropTypes.object),
        onFind: PropTypes.func,
        onDrop: PropTypes.func,
        onRemove: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind();
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
                    <strong>{titleType} Files</strong> <Badge>{fileComponents.length}</Badge>
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
            </div>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.files.documents
    };
};

const mapDispatchProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findFiles());
        },

        onRemove: (fileId) => {
            dispatch(removeFile(fileId));
        },

        onDrop: (fileType, acceptedFiles) => {
            const file = acceptedFiles[0];
            const localId = createRandomString();

            dispatch(upload(localId, file, fileType, (e) => dispatch(uploadProgress(localId, e.percent))));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchProps)(FileManager);

export default Container;
