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
import { assign, pick } from "lodash";
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
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func
    };

    componentDidUpdate (prevProps, prevState) {
        if (!prevState.imported && this.state.imported) {
            this.props.onHide();
        }
    }

    componentWillUnmount () {
        dispatcher.db.files.off("change", this.updateFiles);
    }

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleDrop = (files) => {
        this.setState({dropped: files[0]}, () => {

            const fileData = assign({"file_type": "hmm"}, pick(this.state.dropped, ["name", "size"]));

            dispatcher.db.files.request("authorize_upload", fileData)
                .success((data) => {
                    const newState = {
                        pending: true,
                        target: data.target,
                        fileId: `${data.target}-${this.state.dropped.name}`
                    };

                    dispatcher.db.files.on("change", this.update);

                    this.setState(newState, () => {
                        Request.post(`/upload/${this.state.target}`)
                            .send(this.state.dropped)
                            .ok(res => res.status === 200)
                            .end(this.importHmm);
                    });
                });
        });
    };

    importHmm = () => {
        dispatcher.db.hmm.request("import_hmm", {file_id: this.state.fileId})
            .success(() => this.setState({imported: true}));
    };

    update = () => {
        const fileDocument = dispatcher.db.files.by("_id", this.state.fileId);

        this.setState({
            uploaded: fileDocument ? fileDocument.size_now: 0
        });
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
