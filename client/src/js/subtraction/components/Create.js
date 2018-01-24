import React from "react";
import { filter, map } from "lodash-es";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Row, Col, ListGroup, Modal } from "react-bootstrap";

import { findFiles } from "../../files/actions";
import { createSubtraction } from "../actions";
import { Button, Icon, Input, ListGroupItem, RelativeTime } from "../../base";

class SubtractionFileItem extends React.Component {

    handleClick = () => {
        this.onClick(this.props.id);
    };

    render () {
        return (
            <ListGroupItem active={this.props.active} onClick={this.handleClick}>
                <Row>
                    <Col xs={7}>
                        <strong>{this.props.file.name}</strong>
                    </Col>
                    <Col xs={5}>
                        Uploaded <RelativeTime time={this.props.uploaded_at} /> by {this.props.user.id}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}

const getInitialState = () => ({
    subtractionId: "",
    fileId: ""
});

class CreateSubtraction extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = (e) => {
        this.setState({subtractionId: e.target.value});
    };

    handleModalEnter = () => {
        this.props.onFindFiles();
    };

    handleModalExited = () => {
        this.setState(getInitialState());
    };

    handleSelectFile = (fileId) => {
        this.setState({
            fileId: fileId === this.state.fileId ? "" : fileId
        });
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onCreate(this.state);
    };

    render () {

        const files = filter(this.props.files, {type: "subtraction"});

        let fileComponents = map(files, file =>
            <SubtractionFileItem
                key={file.id}
                {...file}
                active={file.id === this.state.fileId}
                onClick={this.handleSelectFile}
            />
        );

        if (!fileComponents.length) {
            fileComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No files found. <Link to="/subtraction/files">Upload some</Link>.
                </ListGroupItem>
            );
        }

        return (
            <Modal
                bsSize="large"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
            >

                <Modal.Header>
                    Create Subtraction
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
                            type="text"
                            label="Unique Name"
                            value={this.state.subtractionId}
                            onChange={this.handleChange}
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
