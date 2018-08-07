import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { withRouter } from "react-router-dom";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { get, upperFirst } from "lodash-es";

import { InputError, SaveButton } from "../../base";
import { createOTU } from "../actions";
import { clearError } from "../../errors/actions";
import { getNextState } from "../otusUtils";

const getInitialState = () => ({
    name: "",
    abbreviation: "",
    errorName: "",
    errorAbbreviation: "",
    error: ""
});

class CreateOTU extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        return getNextState(prevState.error, nextProps.error);
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        const error = `error${upperFirst(name)}`;

        this.setState({
            [name]: value,
            [error]: ""
        });

        if (this.props.error) {
            this.props.onClearError("CREATE_OTU_ERROR");
        }
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalExited = () => {
        this.setState(getInitialState());

        if (this.props.error) {
            this.props.onClearError("CREATE_OTU_ERROR");
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
            this.props.onSubmit(this.props.refId, this.state.name, this.state.abbreviation);
        }

    };

    render () {

        return (
            <Modal show={this.props.show} onHide={this.handleHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create OTU
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
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
                            <SaveButton />
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: !!state.router.location.state && state.router.location.state.createOTU,
    error: get(state, "errors.CREATE_OTU_ERROR.message", ""),
    pending: state.otus.createPending,
    refId: state.references.detail.id
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (refId, name, abbreviation) => {
        dispatch(createOTU(refId, name, abbreviation));
    },

    onHide: ({ location }) => {
        dispatch(push({...location, state: {createOTU: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(CreateOTU));
