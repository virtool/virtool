import React from "react";
import { Modal } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { find } from "lodash-es";
import { Alert, ProgressBar, SaveButton, UploadBar } from "../../base";
import { createRandomString, getTargetChange } from "../../utils/utils";
import { upload } from "../../files/actions";
import { importReference } from "../actions";
import { clearError } from "../../errors/actions";
import ReferenceForm from "./Form";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "genome",
    organism: "",
    errorName: "",
    errorDataType: "",
    errorFile: "",
    localId: ""
});

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
        this.props.onDrop("reference", file[0], localId);
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
            this.props.importId
        );
    };

    render() {
        let progress = 0;
        let uploadedFile;
        let message = "";

        if (this.state.localId.length) {
            uploadedFile = find(this.props.uploads, { localId: this.state.localId });
            if (uploadedFile) {
                progress = uploadedFile.progress;
            }
        }

        if (progress !== 0 && progress < 100) {
            message = `File upload in progress: ${uploadedFile.name}`;
        } else if (progress === 100) {
            message = `Upload complete: ${uploadedFile.name}`;
        }

        const fileErrorStyle = {
            border: this.state.errorFile.length ? "1px solid #d44b40" : "1px solid transparent",
            marginBottom: "3px"
        };

        return (
            <form onSubmit={this.handleSubmit}>
                <Modal.Body>
                    <Alert>
                        <strong>
                            Create a reference from a file previously exported from another Virtool reference.
                        </strong>
                    </Alert>
                    <ProgressBar
                        bsStyle={progress === 100 ? "success" : "warning"}
                        now={progress}
                        affixed
                        style={{ marginBottom: "10px" }}
                    />
                    <UploadBar onDrop={this.handleDrop} message={message} style={fileErrorStyle} />
                    <ReferenceForm state={this.state} onChange={this.handleChange} toggle={this.toggleCheck} />
                </Modal.Body>

                <Modal.Footer>
                    <SaveButton disabled={progress !== 100 && progress !== 0} altText="Import" />
                </Modal.Footer>
            </form>
        );
    }
}

const mapStateToProps = state => ({
    uploads: state.files.uploads,
    importId: state.references.importData ? state.references.importData.id : null
});

const mapDispatchToProps = dispatch => ({
    onSubmit: (name, description, dataType, organism, fileId) => {
        dispatch(importReference(name, description, dataType, organism, fileId));
    },

    onDrop: (fileType, file, localId) => {
        dispatch(upload(localId, file, fileType));
    },

    onHide: () => {
        dispatch(push({ ...window.location, state: { importReference: false } }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ImportReference);
