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

import React, { PropTypes } from "react";
import { filter } from "lodash";
import { connect } from "react-redux";
import { Row, Col, ListGroup, Modal } from "react-bootstrap";

import { findFiles } from "../../files/actions";
import { createSubtraction, hideSubtractionModal } from "../actions";
import { Button, Input, ListGroupItem, RelativeTime } from "virtool/js/components/Base";

const getInitialState = () => ({
    subtractionId: "",
    fileId: "",
});

/**
 * A component based on React-Bootstrap Modal that presents a form used to add a new host from a FASTA file.
 */
class CreateSubtraction extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool.isRequired,
        files: PropTypes.arrayOf(PropTypes.object),
        onHide: PropTypes.func,
        onFindFiles: PropTypes.func,
        onCreate: PropTypes.func
    };

    modalEnter = () => {
        this.props.onFindFiles();
        this.idNode.focus()
    };

    modalExited = () => {
        this.setState(getInitialState());
    };

    /**
     * Callback triggered by the form submit event. Sends a request to the server requesting a new job for adding a new
     * host. If the request is successful, the modal will close.
     *
     * @param event {object} - the submit event; used only to prevent the default behaviour
     */
    handleSubmit = (event) => {
        event.preventDefault();
        this.props.onCreate(this.state.subtractionId, this.state.fileId);
    };

    render () {

        const fileComponents = filter(this.props.files, {type: "subtraction"}).map(file => {
            const active = file.id === this.state.fileId;

            return (
                <ListGroupItem
                    key={file.id}
                    active={active}
                    onClick={() => this.setState({fileId: active ? "": file.id})}
                >
                    <Row>
                        <Col xs={4}>
                            {file.name}
                        </Col>
                        <Col xs={8}>
                            Uploaded <RelativeTime time={file.uploaded_at} /> by {file.user.id}
                        </Col>
                    </Row>
                </ListGroupItem>
            );
        });

        return (
            <Modal show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.modalEnter}
                onExited={this.modalExited}
            >
                <Modal.Header>
                    Create Subtraction
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
                            ref={(node) => this.idNode = node}
                            type="text"
                            label="Unique Name"
                            value={this.state.subtractionId}
                            onChange={(e) => this.setState({subtractionId: e.target.value})}
                        />

                        <h5><strong>Files</strong></h5>
                        <ListGroup>
                            {fileComponents}
                        </ListGroup>
                    </Modal.Body>

                    <Modal.Footer className="modal-footer">
                        <Button
                            type="submit"
                            bsStyle="primary"
                            icon="play"
                            pullRight
                        >
                            Start
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        show: state.subtraction.showCreate,
        files: state.files.documents
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFindFiles: () => {
            dispatch(findFiles());
        },

        onCreate: (subtractionId, fileId) => {
            dispatch(createSubtraction(subtractionId, fileId));
        },

        onHide: () => {
            dispatch(hideSubtractionModal());
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(CreateSubtraction);

export default Container;
