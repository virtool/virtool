import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Checkbox, Input, InputContainer, InputError, InputGroup, InputLabel, Select } from "../../../../base";

const moleculeTypes = ["", "ssDNA", "dsDNA", "ssRNA+", "ssRNA-", "ssRNA", "dsRNA"];

const StyledSegmentForm = styled.div`
    display: grid;
    grid-template-columns: 3fr 1fr;
    grid-gap: 15px;
`;

class SegmentForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isChecked: true,
            showError: this.props.newEntry.showError,
            error: ""
        };
    }

    static getDerivedStateFromProps(nextProps) {
        if (nextProps.errors && nextProps.errors.EDIT_OTU_ERROR) {
            return { error: nextProps.errors.EDIT_OTU_ERROR.message };
        }

        let error = "";

        error = nextProps.newEntry.showError ? "Required Field" : "";
        error = nextProps.newEntry.nameTaken ? "Segment names must be unique. This name is currently in use." : error;

        return {
            isChecked: nextProps.newEntry.required,
            showError: nextProps.newEntry.showError,
            error
        };
    }

    handleChangeName = e => {
        this.props.onChange({
            ...this.props.newEntry,
            name: e.target.value
        });
        this.setState({ error: "" });
    };

    handleChangeMolecule = e => {
        this.props.onChange({
            ...this.props.newEntry,
            molecule: e.target.value
        });
        this.setState({ error: "" });
    };

    toggleRequired = () => {
        this.props.onChange({
            ...this.props.newEntry,
            required: !this.state.isChecked
        });
        this.setState({ isChecked: !this.state.isChecked, error: "" });
    };

    render() {
        const molecules = map(moleculeTypes, molecule => (
            <option key={molecule} value={molecule}>
                {molecule || "None"}
            </option>
        ));

        return (
            <StyledSegmentForm>
                <InputGroup>
                    <InputLabel>Name</InputLabel>
                    <InputContainer>
                        <Input value={this.props.newEntry.name} onChange={this.handleChangeName} />
                        <InputError>{this.state.error}</InputError>
                    </InputContainer>
                </InputGroup>

                <InputGroup>
                    <InputLabel>Molecule Type</InputLabel>
                    <Select value={this.props.newEntry.molecule} onChange={this.handleChangeMolecule}>
                        {molecules}
                    </Select>
                </InputGroup>

                <Checkbox label="Segment Required" checked={this.state.isChecked} onClick={this.toggleRequired} />
            </StyledSegmentForm>
        );
    }
}

SegmentForm.propTypes = {
    onChange: PropTypes.func.isRequired,
    newEntry: PropTypes.object.isRequired,
    errors: PropTypes.object
};

const mapStateToProps = state => ({
    errors: state.errors
});

export default connect(mapStateToProps, null)(SegmentForm);
