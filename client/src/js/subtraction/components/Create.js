import React from "react";
import { filter } from "lodash";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Row, Col, ListGroup, Modal } from "react-bootstrap";

import { findFiles } from "../../files/actions";
import { createSubtraction } from "../actions";
import { Button, Icon, Input, ListGroupItem, RelativeTime } from "../../base";

const getInitialState = () => ({
    subtractionId: "",
    fileId: ""
});

class CreateSubtraction extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    modalEnter = () => {
        this.props.onFindFiles();
    };

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onCreate(this.state);
    };

    render () {

        let fileComponents = filter(this.props.files, {type: "subtraction"}).map(file => {
            const active = file.id === this.state.fileId;

            return (
                <ListGroupItem
                    key={file.id}
                    active={active}
                    onClick={() => this.setState({fileId: active ? "" : file.id})}
                >
                    <Row>
                        <Col xs={7}>
                            <strong>{file.name}</strong>
                        </Col>
                        <Col xs={5}>
                            Uploaded <RelativeTime time={file.uploaded_at} /> by {file.user.id}
                        </Col>
                    </Row>
                </ListGroupItem>
            );
        });

        if (!fileComponents.length) {
            fileComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No files found. <Link to="/subtraction/files">Upload some</Link>.
                </ListGroupItem>
            );
        }

        return (
            <Modal bsSize="large" show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}
                onExited={this.modalExited}>

                <Modal.Header>
                    Create Subtraction
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
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

const mapStateToProps = (state) => ({
    files: state.files.documents
});

const mapDispatchToProps = (dispatch) => ({

    onFindFiles: () => {
        dispatch(findFiles("subtraction"));
    },

    onCreate: ({ subtractionId, fileId }) => {
        dispatch(createSubtraction(subtractionId, fileId));
    }
});

const Container = connect(mapStateToProps, mapDispatchToProps)(CreateSubtraction);

export default Container;
