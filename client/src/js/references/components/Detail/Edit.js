import React from "react";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { Modal } from "react-bootstrap";
import { ReferenceForm } from "../Form";
import { editReference } from "../../actions";
import { clearError } from "../../../errors/actions";
import { SaveButton } from "../../../base";
import { routerLocationHasState, getTargetChange } from "../../../utils/utils";

const getInitialState = detail => ({
    name: detail.name,
    description: detail.description,
    dataType: detail.data_type,
    organism: detail.organism,
    errorName: "",
    errorDataType: ""
});

export class EditReference extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        if (name !== "name" && name !== "dataType") {
            return this.setState({ [name]: value });
        }

        this.setState({
            [name]: value,
            [error]: ""
        });
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props.detail));
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name.length) {
            this.setState({ errorName: "Required Field" });
        }

        if (!this.state.dataType.length) {
            this.setState({ errorDataType: "Required Field" });
        }

        if (this.state.name.length && this.state.dataType.length) {
            this.props.onSubmit(this.props.detail.id, {
                name: this.state.name,
                description: this.state.description,
                data_type: this.state.dataType,
                organism: this.state.organism,
                internal_control: this.state.internalControl
            });
            this.props.onHide();
        }
    };

    render() {
        return (
            <Modal show={this.props.show} onHide={this.handleHide} onEnter={this.handleModalEnter}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Edit Reference
                </Modal.Header>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <ReferenceForm state={this.state} onChange={this.handleChange} />
                    </Modal.Body>

                    <Modal.Footer>
                        <SaveButton pullRight />
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "editReference"),
    detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({
    onSubmit: (refId, update) => {
        dispatch(editReference(refId, update));
    },

    onHide: () => {
        dispatch(push({ state: { editReference: false } }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditReference);
