import { find } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import {
    AffixedProgressBar,
    Alert,
    Box,
    DialogBody,
    DialogFooter,
    SaveButton,
    TopProgressBar,
    UploadBar
} from "../../base";
import { clearError } from "../../errors/actions";
import { upload } from "../../files/actions";
import { createRandomString, getTargetChange } from "../../utils/utils";
import { importReference } from "../actions";
import { getImportData } from "../selectors";
import { ReferenceForm } from "./Form";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "genome",
    organism: "",
    errorName: "",
    errorDataType: "",
    errorFile: "",
    localId: "",
    mode: "import"
});

const ImportReferenceUploadContainer = styled(Box)`
    padding: 15px 15px 0;
`;

class ImportReference extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.localId !== this.state.localId) {
            this.props.lock(true);
        }

        if (prevState.localId.length) {
            const file = find(this.props.uploads, { localId: prevState.localId });
            if (!file || file.progress === 0 || file.progress === 100) {
                this.props.lock(false);
            }
        }
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);
        this.setState({ [name]: value, [error]: "" });
    };

    handleDrop = file => {
        if (file.length > 1) {
            return this.setState({
                errorFile: "Only one file can be uploaded at a time"
            });
        }

        this.setState({ errorFile: "" });

        const localId = createRandomString();
        this.setState({ localId });
        this.props.onDrop(localId, file[0], "reference");
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name.length) {
            return this.setState({ errorName: "Required Field" });
        }

        if (!this.state.localId.length) {
            return this.setState({ errorFile: "A reference file must be uploaded" });
        }

        this.props.onSubmit(
            this.state.name,
            this.state.description,
            this.state.dataType,
            this.state.organism,
            this.props.file.id
        );
    };

    render() {
        const { file } = this.props;

        let message;
        let progress = 0;

        if (file) {
            progress = file.progress;
            message = file.ready ? `${file.name}` : "Uploading...";
        }

        const fileErrorStyle = {
            border: `1px solid ${this.state.errorFile.length ? "#d44b40" : "transparent"}`,
            marginBottom: "3px"
        };

        return (
            <form onSubmit={this.handleSubmit}>
                <DialogBody>
                    <Alert>
                        <strong>
                            Create a reference from a file previously exported from another Virtool reference.
                        </strong>
                    </Alert>

                    <ImportReferenceUploadContainer>
                        <AffixedProgressBar color={progress === 100 ? "green" : "orange"} now={progress} />
                        <UploadBar onDrop={this.handleDrop} message={message} style={fileErrorStyle} />
                    </ImportReferenceUploadContainer>

                    <ReferenceForm
                        name={this.state.name}
                        description={this.state.description}
                        dataType={this.state.dataType}
                        organism={this.state.organism}
                        errorName={this.state.errorName}
                        errorDataType={this.state.errorDataType}
                        errorFile={this.state.errorFile}
                        localId={this.state.localId}
                        mode="import"
                        onChange={this.handleChange}
                        toggle={this.toggleCheck}
                    />
                </DialogBody>

                <DialogFooter>
                    <SaveButton disabled={progress !== 100 && progress !== 0} altText="Import" />
                </DialogFooter>
            </form>
        );
    }
}

const mapStateToProps = state => ({
    file: getImportData(state)
});

const mapDispatchToProps = dispatch => ({
    onSubmit: (name, description, dataType, organism, fileId) => {
        dispatch(importReference(name, description, dataType, organism, fileId));
    },

    onDrop: (localId, file, fileType) => {
        dispatch(upload(localId, file, fileType));
    },

    onHide: () => {
        dispatch(pushState({ importReference: false }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ImportReference);
