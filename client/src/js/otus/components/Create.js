import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { Modal, ModalHeader } from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange, routerLocationHasState } from "../../utils/utils";
import { createOTU } from "../actions";
import { OTUForm } from "./Form";

const getInitialState = () => ({
    name: "",
    abbreviation: "",
    error: ""
});

class CreateOTU extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({ [name]: value, [error]: "" });

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleModalExited = () => {
        this.setState(getInitialState());

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                error: "Name required"
            });
        }

        if (!this.state.error) {
            this.props.onSubmit(this.props.refId, this.state.name, this.state.abbreviation);
        }
    };

    render() {
        const error = this.state.error || this.props.error || "";

        return (
            <Modal
                label="Create OTU"
                show={this.props.show}
                onHide={this.props.onHide}
                onExited={this.handleModalExited}
            >
                <ModalHeader>Create OTU</ModalHeader>
                <OTUForm
                    name={this.state.name}
                    abbreviation={this.state.abbreviation}
                    onSubmit={this.handleSubmit}
                    onChange={this.handleChange}
                    error={error}
                />
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    error: get(state, "errors.CREATE_OTU_ERROR.message", ""),
    pending: state.otus.createPending,
    refId: state.references.detail.id,
    show: routerLocationHasState(state, "createOTU")
});

const mapDispatchToProps = dispatch => ({
    onSubmit: (refId, name, abbreviation) => {
        dispatch(createOTU(refId, name, abbreviation));
    },

    onHide: () => {
        dispatch(pushState({ createOTU: false }));
    },

    onClearError: () => {
        dispatch(clearError("CREATE_OTU_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateOTU);
