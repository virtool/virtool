import React from "react";
import { Row, Col, Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { updateSubtraction } from "../actions";
import { SaveButton, InputError } from "../../base";

const getInitialState = props => ({
    subtractionId: props.entry.id,
    fileId: props.entry.file.name,
    nickname: props.entry.nickname
});

export class EditSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleSubmit = e => {
        e.preventDefault();
        this.props.onUpdate(this.state.subtractionId, this.state.nickname);
        this.props.exited();
    };

    render() {
        return (
            <Modal show={this.props.show} onHide={this.props.exited} onExited={this.props.exited}>
                <Modal.Header closeButton>Edit Subtraction</Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body style={{ margin: "0 0 10px 0" }}>
                        <Row>
                            <Col md={12}>
                                <InputError type="text" label="Unique Name" value={this.state.subtractionId} readOnly />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={12}>
                                <InputError
                                    type="text"
                                    label="Nickname"
                                    value={this.state.nickname}
                                    onChange={e => this.setState({ nickname: e.target.value })}
                                />
                            </Col>
                        </Row>
                        <Row>
                            <Col md={12}>
                                <InputError type="text" label="File" value={this.state.fileId} readOnly />
                            </Col>
                        </Row>
                    </Modal.Body>

                    <Modal.Footer className="modal-footer">
                        <SaveButton pullRight />
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapDispatchToProps = dispatch => ({
    onUpdate: (id, nickname) => {
        dispatch(updateSubtraction(id, nickname));
    }
});

export default connect(null, mapDispatchToProps)(EditSubtraction);
