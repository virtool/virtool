import React from "react";
import { get, pick } from "lodash-es";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Row, Col, Modal } from "react-bootstrap";

import { editSample } from "../actions";
import { clearError } from "../../errors/actions";
import { Button, InputError } from "../../base";

const getInitialState = ({ name, isolate, host }) => ({
    name: name || "",
    isolate: isolate || "",
    host: host || "",
    error: ""
});

class EditSample extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    componentWillReceiveProps (nextProps) {
        if (!this.props.error && nextProps.error) {
            this.setState({ error: nextProps.error });
        }
    }

    handleChange = (e) => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });

        if (this.state.error) {
            this.props.onClearError("UPDATE_SAMPLE_ERROR");
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                error: "Required Field"
            });
        }

        this.props.onEdit(this.props.id, pick(this.state, ["name", "isolate", "host"]));
    };

    render () {

        return (
            <Modal show={this.props.show} onEnter={this.handleModalEnter} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Sample
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Row>
                            <Col xs={12}>
                                <InputError
                                    label="Name"
                                    name="name"
                                    value={this.state.name}
                                    onChange={this.handleChange}
                                    error={this.state.error}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <InputError
                                    label="Isolate"
                                    name="isolate"
                                    value={this.state.isolate}
                                    onChange={this.handleChange}
                                />
                            </Col>
                            <Col xs={12} md={6}>
                                <InputError
                                    label="Host"
                                    name="host"
                                    value={this.state.host}
                                    onChange={this.handleChange}
                                />
                            </Col>
                        </Row>

                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="save">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.samples.detail,
    show: get(state.router.location.state, "editSample", false),
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(push({state: {showEdit: false}}));
    },

    onEdit: (sampleId, update) => {
        dispatch(editSample(sampleId, update));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(EditSample);
