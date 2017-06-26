import React, { PropTypes } from "react";
import { connect } from "react-redux";
import Dropzone from "react-dropzone";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { byteSize } from "virtool/js/utils";
import { findFiles, removeFile } from "../../files/actions";
import { Button, Icon, ListGroupItem, RelativeTime } from "virtool/js/components/Base";
import { uploadReads, uploadProgress } from "../../files/actions";
import { createRandomString } from "../../utils";

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
                Uploaded <RelativeTime time={props.uploaded_at} /> by {props.user_id}
            </Col>
            <Col md={1}>
                <Icon name="remove" bsStyle="danger" pullRight onClick={() => props.onRemove(props.file_id)} />
            </Col>
        </Row>
    </ListGroupItem>
);

File.propTypes = {
    name: PropTypes.string,
    size: PropTypes.number,
    file_id: PropTypes.string,
    uploaded_at: PropTypes.string,
    user_id: PropTypes.string,
    onRemove: PropTypes.func
};

class ReadFiles extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object),
        onFind: PropTypes.func,
        onDrop: PropTypes.func,
        onRemove: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind();
    }

    render () {
        if (this.props.documents === null) {
            return <div />;
        }

        let fileComponents = this.props.documents.map(document =>
            <File
                key={document.file_id}
                {...document}
                onRemove={this.props.onRemove}
            />
        );

        if (!fileComponents.length) {
            fileComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No read files found
                </ListGroupItem>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>Read Files</strong> <Badge>{fileComponents.length}</Badge>
                </h3>

                <div className="toolbar">
                    <Dropzone
                        ref={(node) => this.dropzone = node}
                        onDrop={this.props.onDrop}
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

        onDrop: (acceptedFiles) => {
            const file = acceptedFiles[0];
            const localId = createRandomString();

            dispatch(uploadReads(localId, file, (e) => dispatch(uploadProgress(localId, e.percent))));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchProps)(ReadFiles);

export default Container;
