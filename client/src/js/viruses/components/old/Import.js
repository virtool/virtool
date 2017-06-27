/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ImportViruses
 */

import React from "react";
import Dropzone from "react-dropzone";
import { includes, pick } from "lodash";
import { Alert, Modal, ListGroup } from "react-bootstrap";
import { Button, Icon, Flex, FlexItem, ListGroupItem, Checkbox } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";

import ImportVirusesProgress from "./Import/Progress";

const getInitialState = () => ({
    fileId: null,
    target: null,
    dropped: null,
    replace: false,
    fileDocument: null,
    complete: false,
    errors: []
});

/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
export default class ImportViruses extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func.isRequired
    };

    componentDidUpdate (prevProps, prevState) {
        if (!prevState.fileId && this.state.fileId) {
            dispatcher.db.files.on("change", this.onFileChange);
        }
    }

    componentWillUnmount () {
        dispatcher.db.files.off("change", this.onFileChange);
    }

    modalExited = () => this.setState(getInitialState());

    onFileChange = () => this.setState({fileDocument: dispatcher.db.files.findOne({_id: this.state.fileId})});

    onDrop = (files) => {
        let errors = [];

        if (!includes(files[0].name, "json.gz")) {
            errors.push(<span>The file must have the extension <strong>json.gz</strong></span>);
        }

        if (errors.length) {
            return this.setState({errors: errors, dropped: null});
        }

        this.setState({dropped: files[0], errors: []});
    };

    upload = () => {
        dispatcher.db.viruses.request("authorize_upload", pick(this.state.dropped, ["name", "size"]))
            .success(data => this.setState({
                target: data.target,
                fileId: `${data.target}-${this.state.dropped.name}`
            }));
    };

    render () {

        let content;

        if (this.state.fileDocument) {
            content = (
                <ImportVirusesProgress
                    fileId={this.state.fileId}
                    fileDocument={this.state.fileDocument}
                    replace={this.state.replace}
                />
            );
        } else {

            const errorComponents = this.state.errors.map((error, index) =>
                <Alert key={index} bsStyle="danger">
                    <Flex alignItems="center">
                        <Icon name="warning" />
                        <FlexItem pad={5}>
                            {error}
                        </FlexItem>
                    </Flex>
                </Alert>
            );

            let dropzoneText = "Drag file here";

            if (this.state.dropped) {
                dropzoneText = `${this.state.dropped.name} (${byteSize(this.state.dropped.size)})`;
            }

            content = (
                <div>
                    {errorComponents}

                    <Flex style={{marginBottom: "15px"}}>
                        <Dropzone
                            ref={(node) => this.dropzone = node}
                            className="dropzone"
                            activeClassName="dropzone-active"
                            onDrop={this.onDrop}
                            multiple={false}
                            disableClick={true}
                        >
                            {dropzoneText}
                        </Dropzone>

                        <Button
                            icon="folder-open"
                            style={{marginLeft: "3px"}}
                            onClick={() => this.dropzone.open()}
                        />
                    </Flex>

                    <ListGroup>
                        <ListGroupItem onClick={() => {this.setState({replace: !this.state.replace})}}>
                            <h5><Checkbox label="Replace Viruses" checked={this.state.replace} /></h5>
                            <p><small>
                                Replace viruses that already exist in the database if they are present in the import
                                file. Matches are made by virus name and are case insensitive.
                            </small></p>
                        </ListGroupItem>
                    </ListGroup>

                    <Button
                        icon="arrow-up"
                        bsStyle="primary"
                        onClick={this.upload}
                        disabled={!this.state.dropped}
                        block
                    >
                        Import
                    </Button>
                </div>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited} >
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Import Viruses
                </Modal.Header>
                <Modal.Body>
                    {content}
                </Modal.Body>
            </Modal>
        );
    }
}
