import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";
import { get, upperFirst } from "lodash-es";

import { editOTU, hideOTUModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { Button, InputError } from "../../../base";

const getInitialState = ({ name = "", abbreviation = "" }) => ({
    name,
    abbreviation,
    errorName: "",
    errorAbbreviation: ""
});

class EditOTU extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
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
            this.props.onClearError("EDIT_OTU_ERROR");
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleHide = () => {
        this.props.onHide(this.props);
        if (this.props.error) {
            this.props.onClearError("EDIT_OTU_ERROR");
        }
    };

    handleSave = (e) => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                errorName: "Required Field"
            });
        }

        if (!this.state.error) {
            this.props.onSave(this.props.OTUId, this.state.name, this.state.abbreviation);
        }
    };

    render () {

        return (
            <Modal show={this.props.show} onEnter={this.handleModalEnter} onHide={this.handleHide}>
                <Modal.Header onHide={this.handleHide} closeButton>
                    Edit OTU
                </Modal.Header>
                <form onSubmit={this.handleSave}>
                    <Modal.Body>
                        <Row>
                            <Col md={8} xs={12}>
                                <InputError
                                    label="Name"
                                    name="name"
                                    value={this.state.name}
                                    onChange={this.handleChange}
                                    error={this.state.errorName}
                                />
                            </Col>
                            <Col md={4} xs={12}>
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
                        <Button type="submit" bsStyle="primary" icon="floppy">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    show: state.OTUs.edit,
    error: get(state, "errors.EDIT_OTU_ERROR.message", "")
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (OTUId, name, abbreviation) => {
        dispatch(editOTU(OTUId, name, abbreviation));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(EditOTU);
