import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";

import { createUser } from "../actions";
import { Icon, Input, Checkbox, Button } from "../../base";

const getInitialState = () => ({
    userId: "",
    password: "",
    confirm: "",
    forceReset: false
});

export class CreateUser extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onCreate(this.state);
    };

    render = () => (
        <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}>
            <Modal.Header onHide={this.props.onHide} closeButton>
                Create User
            </Modal.Header>
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <Row>
                        <Col xs={12}>
                            <Input
                                label="Username"
                                value={this.state.userId}
                                onChange={(e) => this.setState({userId: e.target.value})}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={6}>
                            <Input
                                type="password"
                                label="Password"
                                value={this.state.password}
                                onChange={(e) => this.setState({password: e.target.value})}
                            />
                        </Col>
                        <Col xs={6}>
                            <Input
                                type="password"
                                label="Confirm"
                                value={this.state.confirm}
                                onChange={(e) => this.setState({confirm: e.target.value})}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <Checkbox
                                label="Force user to reset password on login"
                                checked={this.state.forceReset}
                                onClick={() => this.setState({forceReset: !this.state.forceReset})}
                            />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button bsStyle="primary" type="submit">
                            <Icon name="floppy"/> Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </form>
        </Modal>
    );
}

const mapStateToProps = state => ({
    error: state.users.createError,
    pending: state.users.createPending
});

const mapDispatchToProps = dispatch => ({

    onCreate: (data) => {
        dispatch(createUser(data));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CreateUser);
