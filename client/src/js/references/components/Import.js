import React from "react";
import { Modal, ButtonToolbar } from "react-bootstrap";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { forEach, upperFirst } from "lodash-es";
import ReferenceForm from "./Form";
import { Button, UploadBar } from "../../base";
import { routerLocationHasState, createRandomString } from "../../utils";
import { upload } from "../../files/actions";
import { createReference } from "../actions";
import { clearError } from "../../errors/actions";

const getInitialState = () => ({
    name: "",
    description: "",
    dataType: "",
    organism: "",
    isPublic: false,
    errorName: "",
    errorDataField: "",
    uploadProgress: 0
});

class OTUImport extends React.Component {

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

    handleDrop = (files) => {
        this.props.onDrop(files[0], this.handleProgress);
    };

    handleProgress = (e) => {
        this.setState({uploadProgress: e.percent});
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

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Import OTUs
                </Modal.Header>

                <Modal.Body>
                    <ReferenceForm state={this.state} onChange={this.handleChange} toggle={this.toggleCheck} />

                    <UploadBar onDrop={this.handleDrop} style={{ marginTop: "20px" }} />
                </Modal.Body>

                <Modal.Footer>
                    <ButtonToolbar className="pull-right">
                        <Button icon="save" type="submit" bsStyle="primary" onClick={this.handleSubmit}>
                            Save
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </Modal>
        );
    }

}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "importReference"),
    importData: state.otus.importData
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, description, dataType, organism, isPublic) => {
        dispatch(createReference(name, description, dataType, organism, isPublic));
    },

    onDrop: (fileType, acceptedFiles) => {
        forEach(acceptedFiles, file => {
            const localId = createRandomString();
            dispatch(upload(localId, file, fileType));
        });
    },

    onHide: () => {
        dispatch(push({...window.location, state: {importReference: false}}));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(OTUImport);


