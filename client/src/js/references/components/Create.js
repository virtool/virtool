import React from "react";
import { connect } from "react-redux";
import { Alert, ButtonToolbar, Modal } from "react-bootstrap";
import { upperFirst } from "lodash-es";
import ReferenceForm from "./Form";
import { createReference } from "../actions";
import { clearError } from "../../errors/actions";
import { Button } from "../../base";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "genome",
    organism: "",
    isPublic: false,
    errorName: "",
    errorDataType: ""
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
        }

    };

    toggleCheck = () => {
        this.setState({ isPublic: !this.state.isPublic });
    };

    render () {

        return (
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <Alert bsStyle="info">
                        <strong>
                            Create an empty reference.
                        </strong>
                    </Alert>
                    <ReferenceForm
                        state={this.state}
                        onChange={this.handleChange}
                        toggle={this.toggleCheck}
                    />
                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button type="submit" icon="save" bsStyle="primary">
                            Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </form>
        );
    }
}

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, description, dataType, organism, isPublic) => {
        dispatch(createReference(name, description, dataType, organism, isPublic));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(null, mapDispatchToProps)(CreateReference);
