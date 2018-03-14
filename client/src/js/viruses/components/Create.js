import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { withRouter } from "react-router-dom";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";

import { InputError, Button } from "../../base";
import { createVirus } from "../actions";

const getInitialState = () => ({
    name: "",
    abbreviation: "",
    error: ""
});

class CreateVirus extends React.Component {

    constructor (props) {
        super(props);

        this.state = getInitialState();
    }

    componentWillReceiveProps (nextProps) {
        console.log("this.props.errors: ", this.props.errors);
        console.log("nextProps.errors: ", nextProps.errors);

        if (nextProps.errors && nextProps.errors.CREATE_VIRUS_ERROR) {
            console.log("set state error message");
            this.setState(() => {
                return { error: nextProps.errors.CREATE_VIRUS_ERROR.message };
            });
        }

        console.log("current state: ", this.state);
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalExited = () => {
        console.log("modal exit");
        this.setState(getInitialState());
    };

    handleSubmit = (e) => {
        e.preventDefault();

        console.log("inside submit");

        if (this.state.name && !this.state.error) {
            console.log("nonempty name, no error: submit form");
            () => (this.props.onSubmit(this.state.name, this.state.abbreviation));
            console.log("check for error update: ", this.state.error);
            // this.props.onHide();
        } else if (!this.state.name) {
            this.setState({
                error: "Required Field"
            });
        }
    };

    render () {
        console.log("RENDER");

        return (
            <Modal show={this.props.show} onHide={this.handleHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Virus
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={9}>
                            <InputError
                                label="Name"
                                name="name"
                                value={this.state.name}
                                onChange={this.handleChange}
                                error={this.state.error}
                            />
                        </Col>
                        <Col md={3}>
                            <InputError
                                label="Abbreviation"
                                name="abbreviation"
                                value={this.state.abbreviation}
                                onChange={this.handleChange}
                            />
                        </Col>
                    </Row>

                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button icon="floppy" type="submit" bsStyle="primary" onClick={this.handleSubmit}>
                            Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: !!state.router.location.state && state.router.location.state.createVirus,
    error: state.viruses.createError,
    errors: state.errors,
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

