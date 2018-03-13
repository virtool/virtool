import React from "react";
import { Row, Col, Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { updateSubtraction } from "../actions";
import { Button, InputError } from "../../base";

const getInitialState = (props) => ({
    subtractionId: props.entry.id,
    fileId: props.entry.file.id,
    nickname: props.entry.nickname,
    show: props.show
});

class EditSubtraction extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    componentWillReceiveProps (nextProps) {
        if (nextProps.show !== this.props.show) {
            this.setState({
                show: nextProps.show
            });
        }
    }

    handleSubmit = (e) => {
        e.preventDefault();

        this.props.onUpdate(this.state.subtractionId, this.state.nickname);
    };

    render () {

        return (
            <Modal
                bsSize="large"
                show={this.state.show}
                onHide={() => this.setState({show: false})}
                onExited={this.props.Exited}
            >
                <Modal.Header closeButton>
                    Edit Subtraction
                </Modal.Header>
                <Modal.Body style={{margin: "0 0 10px 0"}}>
                    <Row>
                        <Col md={6}>
                            <InputError
                                type="text"
                                label="Unique Name"
                                value={this.state.subtractionId}
                                readOnly
                            />
                        </Col>
                        <Col md={6}>
                            <InputError
                                type="text"
                                label="Nickname"
                                value={this.state.nickname}
                                onChange={(e) => this.setState({nickname: e.target.value})}
                            />
                        </Col>
                    </Row>
                </Modal.Body>

                <Modal.Footer className="modal-footer">
                    <Button
                        type="submit"
                        bsStyle="primary"
                        icon="floppy"
                        onClick={this.handleSubmit}
                        pullRight
                    >
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapDispatchToProps = (dispatch) => ({
    onUpdate: (id, nickname) => {
        dispatch(updateSubtraction(id, nickname));
    }
});

export default connect(null, mapDispatchToProps)(EditSubtraction);
