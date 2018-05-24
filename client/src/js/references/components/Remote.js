import React from "react";
import { connect } from "react-redux";
import { Modal, ButtonToolbar } from "react-bootstrap";
import { upperFirst } from "lodash-es";
import ReferenceForm from "./Form";
import { remoteReference } from "../actions";
import { clearError } from "../../errors/actions";
import { Button } from "../../base";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "",
    organism: "",
    isPublic: false,
    errorName: "",
    errorDataType: ""
});

export class RemoteReference extends React.Component {

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
            <React.Fragment>
                <Modal.Body>
                    <ReferenceForm state={this.state} onChange={this.handleChange} toggle={this.toggleCheck} />
                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button icon="save" type="submit" bsStyle="primary" onClick={this.handleSubmit}>
                            Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </React.Fragment>
        );
    }
}

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, description, dataType, organism, isPublic) => {
        dispatch(remoteReference(name, description, dataType, organism, isPublic));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(null, mapDispatchToProps)(RemoteReference);
