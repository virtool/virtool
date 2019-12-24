import React from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";
import styled from "styled-components";
import { createReference } from "../actions";
import { clearError } from "../../errors/actions";

import { Alert, Button, ButtonToolbar } from "../../base";
import { getTargetChange } from "../../utils/utils";
import { ReferenceForm } from "./Form";

const Container = styled.div`
    display: flex;
    flex-direction: column;
    margin: 15px;
`;

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "genome",
    organism: "",
    errorName: "",
    errorDataType: "",
    mode: "create"
});

export class CreateReference extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({
            [name]: value,
            [error]: ""
        });
    };

    handleChangeDataType = dataType => {
        this.setState({ dataType });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name.length) {
            this.setState({ errorName: "Required Field" });
        }

        if (!this.state.dataType.length) {
            this.setState({ errorDataType: "Required Field" });
        }

        if (this.state.name.length && this.state.dataType.length) {
            this.props.onSubmit(this.state.name, this.state.description, this.state.dataType, this.state.organism);
        }
    };

    render() {
        return (
            <Container>
                <form onSubmit={this.handleSubmit}>
                    <Alert>
                        <strong>Create an empty reference.</strong>
                    </Alert>
                    <ReferenceForm
                        description={this.state.description}
                        errorFile={this.state.errorFile}
                        errorName={this.state.errorName}
                        errorSelect={this.state.errorSelect}
                        name={this.state.name}
                        mode={this.state.mode}
                        organism={this.state.organism}
                        onChange={this.handleChange}
                    />
                    <Modal.Footer>
                        <ButtonToolbar>
                            <Button type="submit" icon="save" bsStyle="primary">
                                Save
                            </Button>
                        </ButtonToolbar>
                    </Modal.Footer>
                </form>
            </Container>
        );
    }
}

export const mapDispatchToProps = dispatch => ({
    onSubmit: (name, description, dataType, organism) => {
        dispatch(createReference(name, description, dataType, organism));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    null,
    mapDispatchToProps
)(CreateReference);
