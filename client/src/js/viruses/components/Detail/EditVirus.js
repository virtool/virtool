import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";

import { editVirus, hideVirusModal } from "../../actions";
import { Button, InputError } from "../../../base";

const getInitialState = ({ name = "", abbreviation = "" }) => ({
    name,
    abbreviation,
    error: ""
});

class EditVirus extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
    }

    componentWillReceiveProps (nextProps) {
        if (!this.state.name) {
            this.setState({ error: "" });
        } else if (nextProps.errors && nextProps.errors.EDIT_VIRUS_ERROR) {
            this.setState({ error: nextProps.errors.EDIT_VIRUS_ERROR.message });
        }
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        this.setState({
            [name]: value
        });
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleSave = (e) => {
        e.preventDefault();

        if (this.state.name && !this.state.error) {
            this.props.onSave(this.props.virusId, this.state.name, this.state.abbreviation);
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
            <Modal show={this.props.show} onEnter={this.handleModalEnter} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Virus
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
                                    error={errorName}
                                />
                            </Col>
                            <Col md={4} xs={12}>
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
    show: state.viruses.edit,
    errors: state.errors
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onSave: (virusId, name, abbreviation) => {
        dispatch(editVirus(virusId, name, abbreviation));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(EditVirus);

export default Container;
