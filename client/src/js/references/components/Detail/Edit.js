import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { map, upperFirst } from "lodash-es";

import { editReference } from "../../actions";
import { clearError } from "../../../errors/actions";
import { InputError, Button, Checkbox } from "../../../base";
import { routerLocationHasState } from "../../../utils";

const getInitialState = (detail) => ({
    name: detail.name,
    description: detail.description,
    dataType: detail.data_type,
    organism: detail.organism,
    isPublic: detail.public,
    errorName: "",
    errorDataField: ""
});

export class EditReference extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.detail);
    }

    handleChange = (e) => {
        const { name, value } = e.target;

        const errorType = `error${upperFirst(e.target.name)}`;

        this.setState({
            [name]: value,
            [errorType]: ""
        });
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalExited = () => {
        this.setState(getInitialState(this.props.detail));
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (!this.state.name.length) {
            this.setState({ errorName: "Required Field" });
        }

        if (!this.state.dataType.length) {
            this.setState({ errorDataType: "Required Field" });
        }

        if (this.state.name.length && this.state.dataType.length) {
            this.props.onSubmit(
                this.props.detail.id,
                {
                    name: this.state.name,
                    description: this.state.description,
                    data_type: this.state.dataType,
                    organism: this.state.organism,
                    public: this.state.isPublic
                }
            );
            this.props.onHide(window.location);
        }

    };

    toggleCheck = () => {
        this.setState({ isPublic: !this.state.isPublic });
    };

    render () {

        const acceptedDataTypes = [
            "",
            "genome"
        ];

        const dataOptions = map(acceptedDataTypes, (type) =>
            <option key={type} value={type} className="text-capitalize">
                {type || "None"}
            </option>
        );

        return (
            <Modal show={this.props.show} onHide={this.handleHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Reference
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col xs={12}>
                            <InputError
                                label="Name"
                                name="name"
                                value={this.state.name}
                                onChange={this.handleChange}
                                error={this.state.errorName}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <InputError
                                label="Description"
                                type="textarea"
                                name="description"
                                value={this.state.description}
                                onChange={this.handleChange}
                            />
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12} md={6}>
                            <InputError
                                label="Data Type"
                                name="dataType"
                                type="select"
                                value={this.state.dataType}
                                onChange={this.handleChange}
                                error={this.state.errorDataType}
                            >
                                {dataOptions}
                            </InputError>
                        </Col>
                        <Col xs={12} md={6}>
                            <InputError
                                label="Organism"
                                name="organism"
                                type="select"
                                value={this.state.organism}
                                onChange={this.handleChange}
                            >
                                {dataOptions}
                            </InputError>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <Checkbox
                                label="Public"
                                checked={this.state.isPublic}
                                onClick={this.toggleCheck}
                            />
                        </Col>
                    </Row>

                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button icon="save" type="submit" bsStyle="primary" onClick={this.handleSubmit}>
                            Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "editReference"),
    detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (refId, update) => {
        dispatch(editReference(refId, update));
    },

    onHide: ({ location }) => {
        dispatch(push({...location, state: {editReference: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(EditReference);
