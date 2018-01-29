import React from "react";
import { filter, map } from "lodash-es";
import { Row, Col, ListGroup, Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { push } from "react-router-redux";


import { findFiles } from "../../files/actions";
import { createSubtraction } from "../actions";
import { Button, Icon, Input, ListGroupItem, RelativeTime } from "../../base";
import {routerLocationHasState} from "../../utils";

class SubtractionFileItem extends React.Component {

    handleClick = () => {
        this.props.onClick(this.props.id);
    };

    render () {

        const { active, name, uploaded_at, user } = this.props;

        return (
            <ListGroupItem active={active} onClick={this.handleClick}>
                <Row>
                    <Col xs={7}>
                        <strong>{name}</strong>
                    </Col>
                    <Col xs={5}>
                        Uploaded <RelativeTime time={uploaded_at} /> by {user.id}
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

        let fileComponents;

        if (files.length) {
            fileComponents = map(files, file =>
                <SubtractionFileItem
                    key={file.id}
                    {...file}
                    active={file.id === this.state.fileId}
                    onClick={this.handleSelectFile}
                />
            );
        } else {
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
    show: routerLocationHasState(state, "createSubtraction"),
    files: state.files.documents
});

const mapDispatchToProps = (dispatch) => ({

    onCreate: ({ subtractionId, fileId }) => {
        dispatch(createSubtraction(subtractionId, fileId));
    },

    onFindFiles: () => {
        dispatch(findFiles("subtraction"));
    },

    onHide: () => {
        dispatch(push({...window.location, state: {createSubtraction: false}}));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(CreateSubtraction);

export default Container;
