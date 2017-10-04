/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ImportModal
 */

import React from "react";
import Dropzone from "react-dropzone";
import { Modal } from "react-bootstrap";
import { byteSize } from "virtool/js/utils";
import { Button, Flex, ProgressBar } from "virtool/js/components/base";

const getInitialState = () => ({
    uploaded: 0,
    checking: false,
    complete: false,
    dropped: null,
    target: null,
    fileId: null
});

export default class ImportModal extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        onHide: PropTypes.func,
        annotationCount: PropTypes.number
    };

    componentDidUpdate () {
        if (this.state.complete && this.state.count !== undefined && this.state.count === this.props.annotationCount) {
            this.props.onHide();
        }
    }

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleDrop = (files) => {
        this.setState({dropped: files[0]});
    };

    render () {

        let dropzone;

        let content;

        if (this.state.target) {
            let message;
            let now;

            if (this.state.checking) {
                message = "Checking";
                now = 88;
            } else if (this.props.annotationCount) {
                message = `Imported ${this.props.annotationCount} of ${this.state.count}`;
                now = (this.props.annotationCount / this.state.count * 40) + 40;
            } else if (this.state.complete) {
                message = "Complete"
                now = 100;
            } else {
                message = `Uploaded ${byteSize(this.state.uploaded)} of ${byteSize(this.state.dropped.size)}`;
                now = this.state.uploaded / this.state.dropped.size * 40
            }

            content = (
                <div>
                    <ProgressBar now={now} />
                    <p className="text-center text-muted">
                        <small>{message}</small>
                    </p>
                </div>
            );
        } else {
            content = (
                <Flex>
                    <Dropzone
                        ref={(node) => dropzone = node}
                        onDrop={this.handleDrop}
                        className="dropzone"
                        activeClassName="dropzone-active"
                        disableClick
                    >
                        Drag file here
                    </Dropzone>

                    <Button icon="folder-open" style={{marginLeft: "3px"}} onClick={() => dropzone.open()}/>
                </Flex>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Upload Annotation file
                </Modal.Header>

                <Modal.Body>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
