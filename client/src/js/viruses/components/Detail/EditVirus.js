import React from "react";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";

import { editVirus, hideVirusModal } from "../../actions";
import { Button, Icon, Input } from "../../../base";

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

        if (!this.state.name) {
            this.setState({error: "Required Field"});
            return;
        }

        this.props.onSave(this.props.virusId, this.state.name, this.state.abbreviation);
    };

    render () {

        let error;

        if (this.props.error) {
            error = (
                <p className="text-danger">
                    <Icon name="warning" /> {this.props.error}
                </p>
            );
        }

        return (
            <Modal show={this.props.show} onEnter={this.handleModalEnter} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Virus
                </Modal.Header>
                <form onSubmit={this.handleSave}>
                    <Modal.Body>
                        <Row>
                            <Col md={6} xs={12}>
                                <Input
                                    label="Name"
                                    name="name"
                                    value={this.state.name}
                                    onChange={this.handleChange}
                                    error={this.state.error}
                                />
                            </Col>
                            <Col md={6} xs={12}>
                                <Input
                                    label="Abbreviation"
                                    name="abbreviation"
                                    value={this.state.abbreviation}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>

                        {error}

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
    error: state.viruses.editError
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
