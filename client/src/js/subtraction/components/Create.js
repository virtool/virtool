import React from "react";
import { filter, map, find } from "lodash-es";
import { Row, Col, ListGroup, Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { push } from "react-router-redux";


import { findFiles } from "../../files/actions";
import { createSubtraction } from "../actions";
import { Button, Icon, InputError, ListGroupItem, RelativeTime } from "../../base";
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
    fileId: "",
    errors: []
});

class CreateSubtraction extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentWillReceiveProps (nextProps) {
        const errors = this.state.errors;

        if (!this.state.subtractionId) {
            this.setState({ error: "" });
        } else if (nextProps.errors && nextProps.errors.CREATE_SUBTRACTION_ERROR) {
            errors.push({
                id: 2,
                message: nextProps.errors.CREATE_SUBTRACTION_ERROR.message
            });

            this.setState({ errors });
        }
    }

    handleChange = (e) => {
        this.setState({
            subtractionId: e.target.value,
            errors: []
        });
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

        const errors = [];

        if (this.state.subtractionId && this.state.fileId) {
            if (!this.state.errors.length) {
                this.props.onCreate(this.state);
            }
        } else {
            if (!this.state.subtractionId) {
                errors.push({
                    id: 0,
                    message: "Required Field"
                });
            }

            if (!this.state.fileId) {
                errors.push({
                    id: 1,
                    message: "Please select a file"
                });
            }
        }

        this.setState({errors});
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

        const errorNameEmpty = find(this.state.errors, ["id", 0]) ? find(this.state.errors, ["id", 0]).message : null;
        const errorFile = find(this.state.errors, ["id", 1]) ? find(this.state.errors, ["id", 1]).message : null;
        const errorNameTaken = find(this.state.errors, ["id", 2]) ? find(this.state.errors, ["id", 2]).message : null;

        const panelListStyle = errorFile ? "panel-list-custom-error" : "panel-list-custom";
        const inputErrorClassName = errorFile ? "input-form-error" : "input-form-error-none";

        const errorMessage = (
            <div className={inputErrorClassName}>
                {errorFile ? errorFile : "None"}
            </div>
        );

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
                    <Modal.Body style={{margin: "0 0 10px 0"}}>
                        <InputError
                            type="text"
                            label="Unique Name"
                            value={this.state.subtractionId}
                            onChange={this.handleChange}
                            error={errorNameEmpty || errorNameTaken}
                        />

                        <h5><strong>Files</strong></h5>
                        <ListGroup className={panelListStyle}>
                            {fileComponents}
                        </ListGroup>
                        {errorMessage}
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
    files: state.files.documents,
    errors: state.errors
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
