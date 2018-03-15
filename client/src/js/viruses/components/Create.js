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
        if (!this.state.name) {
            this.setState({ error: "" });
        } else if (nextProps.errors && nextProps.errors.CREATE_VIRUS_ERROR) {
            this.setState({ error: nextProps.errors.CREATE_VIRUS_ERROR.message });
        }
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
        this.setState(getInitialState());
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.name && !this.state.error) {
            this.props.onSubmit(this.state.name, this.state.abbreviation);
        } else if (!this.state.name) {
            this.setState({
                error: "Required Field"
            });
        }
    };

    render () {
        const errorName = (this.state.error === "Abbreviation already exists") ? null : this.state.error;
        const errorAbbreviation = (this.state.error === "Abbreviation already exists") ? this.state.error : null;

        return (
            <Modal show={this.props.show} onHide={this.handleHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Virus
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={8}>
                            <InputError
                                label="Name"
                                name="name"
                                value={this.state.name}
                                onChange={this.handleChange}
                                error={errorName}
                            />
                        </Col>
                        <Col md={4}>
                            <InputError
                                label="Abbreviation"
                                name="abbreviation"
                                value={this.state.abbreviation}
                                onChange={this.handleChange}
                                error={errorAbbreviation}
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

