import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { withRouter } from "react-router-dom";
import { Row, Col, Modal, Alert, ButtonToolbar } from "react-bootstrap";

import { Icon, Flex, FlexItem, Input, Button } from "../../base";
import { createVirus } from "../actions";

const getInitialState = () => ({
    name: "",
    abbreviation: ""
});

class CreateVirus extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleSubmit = (e) => {
        e.preventDefault();
        this.props.onSubmit(this.state.name, this.state.abbreviation);
    };

    render () {

        let alert;

        if (this.props.error) {
            alert = (
                <Alert bsStyle="danger">
                    <Flex>
                        <FlexItem grow={0} shrink={0}>
                            <Icon name="warning" />
                        </FlexItem>
                        <FlexItem grow={1} shrink={0} pad>
                            {this.props.error}
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        return (
            <Modal show={this.props.show} onHide={() => this.props.onHide(this.props)} onExited={this.modalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Virus
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col md={9}>
                                <Input
                                    type="text"
                                    label="Name"
                                    value={this.state.name}
                                    onChange={(e) => this.setState({name: e.target.value})}
                                />
                            </Col>
                            <Col md={3}>
                                <Input
                                    type="text"
                                    label="Abbreviation"
                                    value={this.state.abbreviation}
                                    onChange={(e) => this.setState({abbreviation: e.target.value})}
                                />
                            </Col>
                        </Row>

                        {alert}
                    </Modal.Body>

                    <Modal.Footer>
                        <ButtonToolbar className="pull-right">
                            <Button icon="floppy" type="submit" bsStyle="primary">
                                Save
                            </Button>
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }

}

const mapStateToProps = state => ({
    show: !!state.router.location.state && state.router.location.state.createVirus,
    error: state.viruses.createError,
    pending: state.viruses.createPending
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, abbreviation) => {
        dispatch(createVirus(name, abbreviation));
    },

    onHide: ({ location }) => {
        dispatch(push({...location, state: {createVirus: false}}));
    }

});

const CreateVirusContainer = withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateVirus));

export default CreateVirusContainer;

