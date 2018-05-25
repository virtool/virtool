import React from "react";
import { Modal, ButtonToolbar } from "react-bootstrap";
import { connect } from "react-redux";
import { upperFirst, find } from "lodash-es";
import ReferenceForm from "./Form";
import { Button } from "../../base";
import { cloneReference } from "../actions";
import { clearError } from "../../errors/actions";

const getInitialState = (refId, refArray) => {

    const originalRef = find(refArray, { id: refId });

    if (originalRef) {
        return {
            name: originalRef.name,
            description: originalRef.description,
            dataType: originalRef.data_type,
            organism: originalRef.organism,
            isPublic: originalRef.public,
            errorName: "",
            errorDataType: "",
            errorNoRef: ""
        };
    }

    return {
        name: "",
        description: "",
        dataType: "",
        organism: "",
        isPublic: false,
        errorName: "",
        errorDataType: "",
        errorNoRef: "Target reference must be pre-selected in order to clone"
    };
};

class CloneReference extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props.refId, this.props.refDocuments);
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

        if (this.state.name.length && this.state.dataType.length && !this.state.errorNoRef.length) {
            this.props.onSubmit(
                this.state.name,
                this.state.description,
                this.state.dataType,
                this.state.organism,
                this.state.isPublic,
                this.props.refId
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
                        <Button
                            icon="save"
                            type="submit"
                            bsStyle="primary"
                            onClick={this.handleSubmit}
                            disabled={!!this.state.errorNoRef.length}
                        >
                            Clone
                        </Button>
                    </ButtonToolbar>
                </Modal.Footer>
            </React.Fragment>
        );
    }

}

const mapStateToProps = state => ({
    refId: state.router.location.state.refId,
    refDocuments: state.references.documents
});

const mapDispatchToProps = dispatch => ({

    onSubmit: (name, description, dataType, organism, isPublic, refId) => {
        dispatch(cloneReference(name, description, dataType, organism, isPublic, refId));
    },

    onClearError: (error) => {
        dispatch(clearError(error));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(CloneReference);
