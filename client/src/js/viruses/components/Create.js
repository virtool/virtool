import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { withRouter } from "react-router-dom";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { get, upperFirst } from "lodash-es";

import { InputError, Button } from "../../base";
import { createVirus } from "../actions";
import { clearError } from "../../errors/actions";

const getInitialState = () => ({
    name: "",
    abbreviation: "",
    errorName: "",
    errorAbbreviation: ""
});

class CreateVirus extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentWillReceiveProps (nextProps) {
        if (!this.props.error && nextProps.error) {
            if (nextProps.error === "Name already exists") {
                this.setState({ errorName: nextProps.error });
            } else if (nextProps.error === "Abbreviation already exists") {
                this.setState({ errorAbbreviation: nextProps.error });
            } else {
                this.setState({
                    errorName: "Name already exists",
                    errorAbbreviation: "Abbreviation already exists"
                });
            }
        }
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        const error = `error${upperFirst(name)}`;

        this.setState({
            [name]: value,
            [error]: ""
        });

        if (this.props.error) {
            this.props.onClearError("CREATE_VIRUS_ERROR");
        }
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalExited = () => {
        this.setState(getInitialState());

        if (this.props.error) {
            this.props.onClearError("CREATE_VIRUS_ERROR");
        }
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                errorName: "Required Field"
            });
        }

        if (!this.state.errorName || !this.state.errorAbbreviation) {
            this.props.onSubmit(this.state.name, this.state.abbreviation);
        }

    };

    render () {

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
                                error={this.state.errorName}
                            />
                        </Col>
                        <Col md={4}>
                            <InputError
                                label="Abbreviation"
                                name="abbreviation"
                                value={this.state.abbreviation}
                                onChange={this.handleChange}
                                error={this.state.errorAbbreviation}
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
    error: get(state, "errors.CREATE_VIRUS_ERROR.message", ""),
    pending: state.viruses.createPending
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, abbreviation) => {
        dispatch(createVirus(name, abbreviation));
    },

    onHide: ({ location }) => {
        dispatch(push({...location, state: {createVirus: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateVirus));
