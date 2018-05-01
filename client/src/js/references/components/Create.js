import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Row, Col, Modal, ButtonToolbar } from "react-bootstrap";
import { map, upperFirst } from "lodash-es";

import { createReference, listReferences } from "../actions";
import { clearError } from "../../errors/actions";
import { InputError, Button, Checkbox } from "../../base";
import { routerLocationHasState } from "../../utils";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "",
    organism: "",
    isPublic: false,
    errorName: "",
    errorDataField: ""
});

export class CreateReference extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
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
        this.setState(getInitialState());
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
                this.state.name,
                this.state.description,
                this.state.dataType,
                this.state.organism,
                this.state.isPublic
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
            <option key={type} value={type}>
                {type || "None"}
            </option>
        );

        return (
            <Modal show={this.props.show} onHide={this.handleHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create Reference
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
                    </Row>
                    <Row>
                        <Col md={8}>
                            <InputError
                                label="Description"
                                type="textarea"
                                name="description"
                                value={this.state.description}
                                onChange={this.handleChange}
                            />
                        </Col>
                        <Col md={4}>
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
                        <Col md={4}>
                            <Checkbox
                                label="Public"
                                checked={this.state.isPublic}
                                onClick={this.toggleCheck}
                                pullRight
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
    show: routerLocationHasState(state, "createReference")
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, description, dataType, organism, isPublic) => {
        dispatch(createReference(name, description, dataType, organism, isPublic));
        dispatch(listReferences());
    },

    onHide: ({ location }) => {
        dispatch(push({...location, state: {createReference: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CreateReference);
