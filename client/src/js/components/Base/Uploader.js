import React from "react";
import Numeral from "numeral";
import Dropzone from "react-dropzone";
import FlipMove from "react-flip-move";
import { sortBy } from "lodash";
import { Icon, RelativeTime, ProgressBar } from "virtool/js/components/Base";
import { Row, Col } from "react-bootstrap";
import { Flex, Button, ListGroupItem, getFlipMoveProps } from "virtool/js/components/Base";


export class FileItem extends React.PureComponent {

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        timestamp: React.PropTypes.string.isRequired,
        created: React.PropTypes.bool,
        ready: React.PropTypes.bool,
        size_now: React.PropTypes.number.isRequired,
        size_end: React.PropTypes.number.isRequired,
        remove: React.PropTypes.func.isRequired
    };

    static defaultProps = {
        created: false,
        ready: false
    };

    render = () => (
        <ListGroupItem className="spaced">
            <ProgressBar
                bsStyle={this.props.ready ? null: "success"}
                now={this.props.created ? this.props.size_now / this.props.size_end * 100: 0}
                affixed
            />
            <Row>
                <Col md={5}>
                    <Icon name="file" /> {this.props.name}
                </Col>
                <Col md={3}>
                    Added <RelativeTime time={this.props.timestamp} />
                </Col>
                <Col md={2}>
                    <span className="pull-right">
                        {Numeral(this.props.size_now).format("0.0 b")}
                    </span>
                </Col>
                <Col md={2}>
                    <Icon
                        className="pull-right"
                        name="remove"
                        bsStyle="danger"
                        onClick={() => this.props.remove(this.props._id)}
                    />
                </Col>
            </Row>
        </ListGroupItem>
    );
}

export const FileList = (props) => {

    let fileComponents;

    if (props.files.length > 0) {
        fileComponents = sortBy(props.files, "timestamp").reverse().map(file =>
            <div key={file._id}>
                <FileItem {...file} remove={props.remove} />
            </div>
        );
    } else {
        fileComponents = (
            <ListGroupItem className="text-center" key="noFiles">
                <Icon name="info" /> No files found
            </ListGroupItem>
        );
    }

    return (
        <div style={{marginTop: "15px"}}>
            <h5>
                {props.header}
            </h5>

            <FlipMove {...getFlipMoveProps()}>
                {fileComponents}
            </FlipMove>
        </div>
    );
};

FileList.propTypes = {
    header: React.PropTypes.element,
    files: React.PropTypes.arrayOf(React.PropTypes.object),
    remove: React.PropTypes.func.isRequired
};

export const Uploader = (props) => {

    let dropzone;

    const readyFiles = props.fileDocuments.branch().find({ready: true}).data();

    const readyHeader = (
        <span>
            <Icon name="checkmark" /> <strong>Ready</strong>
        </span>
    );

    const uploadingFiles = props.fileDocuments.branch().find({ready: false}).data();

    let uploadingList;

    if (uploadingFiles.length > 0) {
        const uploadingHeader = (
            <span>
                <Icon name="meter" /> <strong>In Progress</strong>
            </span>
        );

        uploadingList = <FileList header={uploadingHeader} files={uploadingFiles} remove={props.onRemove} />;
    }

    return (
        <div>
            <Flex>
                <Dropzone
                    ref={(node) => dropzone = node}
                    onDrop={props.onDrop}
                    className="dropzone"
                    activeClassName="dropzone-active"
                    disableClick
                >
                    Drag file here to upload
                </Dropzone>

                <Button icon="folder-open" style={{marginLeft: "3px"}} onClick={() => dropzone.open()}/>
            </Flex>

            {uploadingList}

            <FileList header={readyHeader} files={readyFiles} remove={props.onRemove} />
        </div>
    );
};

Uploader.propTypes = {
    fileDocuments: React.PropTypes.object,
    onDrop: React.PropTypes.func.isRequired,
    onRemove: React.PropTypes.func.isRequired
};
