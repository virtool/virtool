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
import Dropzone from "react-dropzone";
import { Modal } from "react-bootstrap";
import { byteSize } from "virtool/js/utils";
import { Button, Flex, ProgressBar } from "virtool/js/components/Base";

const getInitialState = () => ({
    uploaded: 0,
    imported: false,
    dropped: null,
    target: null,
    fileId: null
});

export default class UploadModal extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        onHide: PropTypes.func
    };

    componentDidUpdate (prevProps, prevState) {
        if (!prevState.imported && this.state.imported) {
            this.props.onHide();
        }
    }

    modalExited = () => {
        this.setState(getInitialState());
    };

    render () {

        let dropzone;

        let content;

        if (this.state.target) {
            let message;
            let now;

            if (this.state.uploaded === this.state.dropped.size) {
                message = "Importing";
                now = 75;
            } else {
                message = `Uploaded ${byteSize(this.state.uploaded)} of ${byteSize(this.state.dropped.size)}`;
                now = this.state.uploaded / this.state.dropped.size * 50
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
                    Upload HMM file
                </Modal.Header>

                <Modal.Body>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
