import { find } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Alert, SaveButton } from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange } from "../../utils/utils";
import { cloneReference } from "../actions";
import { ReferenceForm } from "./Form";
import { ReferenceSelector } from "./ReferenceSelector";

const getInitialState = (refId, refArray) => {
    const originalRef = find(refArray, { id: refId });

    if (originalRef) {
        return {
            reference: originalRef.id,
            name: `Clone of ${originalRef.name}`,
            description: originalRef.description,
            dataType: originalRef.data_type || "",
            organism: originalRef.organism,
            errorName: "",
            errorDataType: "",
            errorSelect: "",
            mode: "clone"
        };
    }
    return {
        reference: refId,
        name: "",
        description: "",
        dataType: "genome",
        organism: "",
        errorName: "",
        errorDataType: "",
        errorSelect: "",
        mode: "clone"
    };
};

export class CloneReference extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props.refId, this.props.refDocuments);
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name === "name" || name === "dataType") {
            this.setState({
                [name]: value,
                [error]: ""
            });
        } else if (name === "reference") {
            this.setState({
                [name]: value,
                errorSelect: ""
            });
        } else {
            this.setState({
                [name]: value
            });
        }
    };

    handleSelect = refId => {
        this.setState(getInitialState(refId, this.props.refDocuments));
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name.length) {
            return this.setState({ errorName: "Required Field" });
        }

        if (!this.state.dataType.length) {
            return this.setState({ errorDataType: "Required Field" });
        }

        if (!this.state.reference) {
            return this.setState({ errorSelect: "Please select a source reference" });
        }

        this.props.onSubmit(
            this.state.name,
            this.state.description,
            this.state.dataType,
            this.state.organism,
            this.state.reference
        );
    };

    render() {
        return (
            <form onSubmit={this.handleSubmit}>
                <Alert>
                    <strong>Clone an existing reference.</strong>
                </Alert>
                <ReferenceSelector
                    references={this.props.refDocuments}
                    onSelect={this.handleSelect}
                    selected={this.state.reference}
                    error={this.state.errorSelect}
                />
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
                <SaveButton disabled={!this.props.refDocuments.length} altText="Clone" />
            </form>
        );
    }
}

export const mapStateToProps = state => ({
    refId: state.router.location.state.id,
    refDocuments: state.references.documents
});

export const mapDispatchToProps = dispatch => ({
    onSubmit: (name, description, dataType, organism, refId) => {
        dispatch(cloneReference(name, description, dataType, organism, refId));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CloneReference);
