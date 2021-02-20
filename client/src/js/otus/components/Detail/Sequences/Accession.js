import { some } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import {
    ModalBody,
    ModalFooter,
    Input,
    InputContainer,
    InputError,
    InputGroup,
    InputIcon,
    InputLabel,
    Loader,
    ModalBodyOverlay,
    SaveButton
} from "../../../../base";
import { getTargetChange } from "../../../../utils/utils";
import { getGenbank } from "../../../api";
import SequenceSegment from "./Segment";
import SequenceField from "./Field";

export class SequenceForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            accession: props.accession || "",
            definition: props.definition || "",
            errorAccession: "",
            errorDefinition: "",
            errorSequence: "",
            host: props.host || "",
            pending: false,
            sequence: props.sequence || "",
            segment: props.segment || "",
            targetName: props.targetName || ""
        };
    }

    static propsTypes = {
        dataType: PropTypes.string.isRequired,
        onSubmit: PropTypes.func.isRequired
    };

    handleAutofill = () => {
        this.setState({ pending: true }, () => {
            getGenbank(this.state.accession).then(
                resp => {
                    const { accession, definition, host, sequence } = resp.body;

                    this.setState({
                        accession,
                        definition,
                        host,
                        sequence,
                        pending: false,
                        errorAccession: "",
                        errorDefinition: "",
                        errorSequence: ""
                    });
                },
                err => {
                    this.setState({
                        pending: false,
                        error: err.status === 404 ? "Accession not found" : ""
                    });
                    return err;
                }
            );
        });
    };

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name === "host") {
            return this.setState({ [name]: value });
        }

        if (name === "accession" && some(this.props.sequences, { accession: value })) {
            return this.setState({
                [name]: value,
                [error]: "Accession is already in use"
            });
        }

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError("ADD_SEQUENCE_ERROR");
            this.props.onClearError("EDIT_SEQUENCE_ERROR");
        }
    };

    render() {
        return (
            <InputGroup>
                <InputLabel>Accession (ID)</InputLabel>
                <InputContainer align="right">
                    <Input name="accession" value={this.state.accession} onChange={this.handleChange} autoFocus />
                    <InputIcon name="magic" onClick={this.handleAutofill} />
                </InputContainer>
                <InputError>{this.state.errorAccession}</InputError>
            </InputGroup>
        );
    }
}
