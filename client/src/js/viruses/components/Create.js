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

        this.state = {show: false, ...getInitialState()};
    }

    componentWillReceiveProps (nextProps) {
        if (nextProps.error !== this.props.error) {
            this.setState({
                error: nextProps.error
            });
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

        if (this.state.name) {
            this.setState({show: false});
            this.props.onSubmit(this.state.name, this.state.abbreviation);
            this.handleHide();
        } else {
            this.setState({
                show: true,
                error: "Required Field"
            });
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

