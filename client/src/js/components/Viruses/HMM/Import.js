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
import Request from "superagent";
import Dropzone from "react-dropzone";
import { assign, pick } from "lodash";
import { Modal } from "react-bootstrap";
import { byteSize } from "virtool/js/utils";
import { Button, Flex, ProgressBar } from "virtool/js/components/Base";

const getInitialState = () => ({
    uploaded: 0,
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
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func,
        annotationCount: React.PropTypes.number
    };

    componentDidUpdate () {
        if (this.state.count !== undefined && this.state.count === this.props.annotationCount) {
            this.props.onHide();
        }
    }

    componentWillUnmount () {
        dispatcher.db.files.off("change", this.updateCount);
    }

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleDrop = (files) => {
        this.setState({dropped: files[0]}, () => {

            const fileData = assign({"file_type": "annotations"}, pick(this.state.dropped, ["name", "size"]));

            dispatcher.db.files.request("authorize_upload", fileData)
                .success((data) => {
                    const newState = {
                        pending: true,
                        target: data.target,
                        fileId: `${data.target}-${this.state.dropped.name}`
                    };

                    dispatcher.db.files.on("change", this.updateFile);

                    this.setState(newState, () => {
                        Request.post(`/upload/${this.state.target}`)
                            .send(this.state.dropped)
                            .ok(res => res.status === 200)
                            .end(this.importAnnotations);
                    });
                });
        });
    };

    importAnnotations = () => {
        dispatcher.db.hmm.request("import_annotations", {file_id: this.state.fileId})
            .update((data) => {
                this.setState({count: data.count});
            })
            .failure((data) => {
                this.setState({warning: data.message});
            });
    };

    updateFile = () => {
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

            if (this.props.annotationCount) {
                message = `Imported ${this.props.annotationCount} of ${this.state.count}`;
                now = (this.props.annotationCount / this.state.count * 50) + 50;
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
                    Upload Annotation file
                </Modal.Header>

                <Modal.Body>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
