import React from "react";
import { Modal, ButtonToolbar } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { upperFirst, find } from "lodash-es";
import ReferenceForm from "./Form";
import { Button, UploadBar, ProgressBar } from "../../base";
import { createRandomString } from "../../utils";
import { upload } from "../../files/actions";
import { importReference } from "../actions";
import { clearError } from "../../errors/actions";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "",
    organism: "",
    isPublic: false,
    errorName: "",
    errorDataType: "",
    errorFileNumber: "",
    localId: "",
    file: null
});

class ImportReference extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidUpdate (prevProps, prevState) {
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

    handleChange = (e) => {
        const { name, value } = e.target;

        const errorType = `error${upperFirst(e.target.name)}`;

        this.setState({
            [name]: value,
            [errorType]: ""
        });
    };

    handleDrop = (file) => {

        if (file.length > 1) {
            return this.setState({
                errorFileNumber: "Only one file can be uploaded at a time"
            });
        }

        this.setState({ errorFileNumber: "" });

        const localId = createRandomString();
        this.setState({ localId });
        this.props.onDrop("reference", file[0], localId);
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
                this.state.isPublic,
                this.props.importId
            );
        }

    };

    toggleCheck = () => {
        this.setState({ isPublic: !this.state.isPublic });
    };

    render () {

        let progress = 0;
        let uploadedFile;
        let message = "";

        if (this.state.localId.length) {
            uploadedFile = find(this.props.uploads, { localId: this.state.localId });
            progress = uploadedFile.progress;
        }

        if (progress !== 0 && progress < 100) {
            message = `File upload in progress: ${uploadedFile.name}`;
        } else if (progress === 100) {
            message = `Upload complete: ${uploadedFile.name}`;
        }

        return (
            <React.Fragment>
                <Modal.Body>
                    <ReferenceForm state={this.state} onChange={this.handleChange} toggle={this.toggleCheck} />
                    <UploadBar onDrop={this.handleDrop} style={{ marginTop: "20px" }} message={message} />
                    <ProgressBar bsStyle={progress === 100 ? "primary" : "success"} now={progress} affixed />
                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button
                            icon="save"
                            type="submit"
                            bsStyle="primary"
                            onClick={this.handleSubmit}
                            disabled={progress !== 100 && progress !== 0}
                        >
                            Import
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </React.Fragment>
        );
    }

}

const mapStateToProps = state => ({
    uploads: state.files.uploads,
    importId: state.references.importData ? state.references.importData.id : null
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, description, dataType, organism, isPublic, fileId) => {
        dispatch(importReference(name, description, dataType, organism, isPublic, fileId));
    },

    onDrop: (fileType, file, localId) => {
        dispatch(upload(localId, file, fileType));
    },

    onHide: () => {
        dispatch(push({...window.location, state: {importReference: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ImportReference);
