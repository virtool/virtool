/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddHost
 */

import React from "react";
import { Modal, ListGroup } from "react-bootstrap";
import { Icon, Flex, FlexItem, Input, Button, ListGroupItem } from "virtool/js/components/Base";
import { byteSize } from "virtool/js/utils";
import { getFiles } from "../Files";

class HostFileSelector extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            documents: getFiles()
        };
    }

    static propTypes = {
        selected: React.PropTypes.string,
        onSelect: React.PropTypes.func.isRequired
    };

    componentDidMount () {
        dispatcher.db.files.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.files.off("change", this.update);
    }

    update = () => this.setState({documents: getFiles()});

    render () {

        let fileComponents = this.state.documents.branch().data().map((file) =>
            <ListGroupItem
                key={file._id}
                active={this.props.selected === file._id}
                onClick={() => this.props.onSelect(file._id)}
            >
                <Flex>
                    <FlexItem grow={1} shrink={0}>
                        {file.name}
                    </FlexItem>
                    <FlexItem grow={0} shrink={0}>
                        {byteSize(file.size_end)}
                    </FlexItem>
                </Flex>
            </ListGroupItem>
        );

        if (fileComponents.length === 0) {
            fileComponents = (
                <ListGroupItem key="none">
                    <Flex justifyContent="center" alignItems="center">
                        <Icon name="notification" />
                        <FlexItem pad={5}>
                            <span>No files found. </span>
                            <a className="pointer" onClick={() => dispatcher.router.setChild("files")}>
                                Upload a fasta file.
                            </a>
                        </FlexItem>
                    </Flex>
                </ListGroupItem>
            )
        }

        return (
            <ListGroup>
                {fileComponents}
            </ListGroup>
        );
    }
}

/**
 * A component based on React-Bootstrap Modal that presents a form used to add a new host from a FASTA file.
 */
export default class AddHost extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            fileId: "",
            organism: "",
            description: ""
        };
    }

    static propTypes = {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    };

    modalEnter = () => {
        this.organismNode.focus();
    };

    modalExited = () => {
        this.setState({
            fileId: "",
            organism: "",
            description: ""
        });
    };

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    /**
     * Callback triggered by the form submit event. Sends a request to the server requesting a new job for adding a new
     * host. If the request is successful, the modal will close.
     *
     * @param event {object} - the submit event; used only to prevent the default behaviour
     */
    handleSubmit = (event) => {
        event.preventDefault();

        // Only submit the request if the two form fields are filled.
        if (this.state.organism && this.state.description.length && this.state.fileId) {
            dispatcher.db.hosts.request("add", {
                file_id: this.state.fileId,
                description: this.state.description,
                organism: this.state.organism
            }).success(this.props.onHide);
        }
    };

    render () {
        // The form is submittable if both fields are filled.
        const submittable = this.state.organism && this.state.description && this.state.fileId;

        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.modalEnter}
                onExited={this.modalExited}
            >
                <Modal.Header>
                    Add Host
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
                            ref={(node) => this.organismNode = node}
                            type="text"
                            className="text-em"
                            name="organism"
                            label="Organism"
                            value={this.state.organism}
                            onChange={this.handleChange}
                        />
                        <Input
                            type="text"
                            name="description"
                            label="Description"
                            value={this.state.description}
                            onChange={this.handleChange}
                        />

                        <h5><strong>Select File</strong></h5>
                        <HostFileSelector
                            selected={this.state.fileId}
                            onSelect={(fileId) => this.setState({fileId: fileId === this.state.fileId ? "": fileId})}
                        />
                    </Modal.Body>

                    <Modal.Footer className="modal-footer">
                        <Button
                            type="submit"
                            onClick={this.submit}
                            bsStyle="primary"
                            icon="plus-square"
                            disabled={!submittable}
                            pullRight
                        >
                            Add
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }

}
