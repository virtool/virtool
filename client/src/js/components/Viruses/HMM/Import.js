/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ImportHMM
 */

import React from "react";
import Request from "superagent";
import Dropzone from "react-dropzone";
import { assign, includes } from "lodash-es";
import { Row, Col, Modal, Panel } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base/Icon";
import { byteSize } from "virtool/js/utils";

function getInitialState () {
    return {
        file: null,
        fileId: null,
        pending: false,
        warning: null,
        added: null
    };
}

export default class ImportHMM extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func
    };

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleDrop =(files) => {
        this.setState(assign(getInitialState(), { file: files[0] }));
    };

    upload = () => {
        this.setState({ pending: true }, () => {
            Request.post("/upload")
                .attach(this.state.file.name, this.state.file)
                .end((data, res) => {
                    this.setState({ fileId: res.text }, this.importData);
                });
        });
    };

    importData = () => {
        dispatcher.db.hmm.request("import_data", { file_id: this.state.fileId })
            .success((data) => {
                this.setState(assign(getInitialState(), { added: data.message }));
            })
            .failure((data) => {
                this.setState({ warning: data.message });
            });
    };

    render () {

        const dropzoneProps = {
            onDrop: this.handleDrop,
            multiple: false,
            disableClick: true
        };

        const style = {
            width: "100%",
            height: "auto",
            border: "1px solid #dddddd",
            borderColor: "#dddddd",
            padding: "15px",
            marginBottom: "15px"
        };

        const activeStyle = assign({
            backgroundColor: "#337ab7",
            borderColor: "#337ab7",
            color: "#ffffff"
        }, style);

        let content;

        let button;

        if (this.state.file) {
            button = (
                <Button bsStyle="primary" onClick={this.upload} block>
                    <Icon name="arrow-up" pending={this.state.pending} /> Import
                </Button>
            );
        }

        let dropzoneContent = "Drag file here.";

        if (this.state.file) {
            const iconName = includes(this.state.file.name, ".gz") ? "file-zip": "file-text";

            dropzoneContent = (
                <span>
                    <Icon name={iconName} /> {this.state.file.name} ({byteSize(this.state.file.size)})
                </span>
            );
        }

        content = (
            <div>
                <Row>
                    <Col md={12}>
                        <Dropzone style={style} activeStyle={activeStyle} {...dropzoneProps} ref="dropzone">
                            <div className="drag-area text-center">
                                {dropzoneContent}
                            </div>
                        </Dropzone>
                    </Col>
                </Row>

                {button}
            </div>
        );

        return (
            <Modal ref="modal" show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>

                <Modal.Header onHide={this.props.onHide} closeButton>
                    Import Viruses
                </Modal.Header>

                <Modal.Body>
                    <Row>
                        <Col md={12}>
                            <Panel>
                                Import annotations from a Virtool-compatible JSON or gzip-compressed JSON file.
                            </Panel>
                        </Col>
                    </Row>

                    {content}

                </Modal.Body>
            </Modal>
        );
    }
}
