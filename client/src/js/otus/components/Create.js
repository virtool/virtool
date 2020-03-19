import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { ModalDialog } from "../../base";
import { clearError } from "../../errors/actions";
import { getTargetChange, routerLocationHasState } from "../../utils/utils";
import { createOTU } from "../actions";
import OTUForm from "./OTUForm";

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
            this.props.onClearError("CREATE_OTU_ERROR");
        }
    };

    handleHide = () => {
        this.props.onHide(this.props);
    };

    handleModalExited = () => {
        this.setState(getInitialState());

        if (this.props.error) {
            this.props.onClearError("CREATE_OTU_ERROR");
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                error: "Name required"
            });
        }

        if (!this.state.errorName || !this.state.errorAbbreviation) {
            this.props.onSubmit(this.props.refId, this.state.name, this.state.abbreviation);
        }
    };

    render() {
        const error = this.state.error || this.props.error || "";

        return (
            <ModalDialog
                label="CreateOTU"
                headerText="Create OTU"
                show={this.props.show}
                onHide={this.handleHide}
                onExited={this.handleModalExited}
            >
                <OTUForm
                    name={this.state.name}
                    abbreviation={this.state.abbreviation}
                    onSubmit={this.handleSubmit}
                    onChange={this.handleChange}
                    error={error}
                />
            </ModalDialog>
        );
    }
}

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "createOTU"),
    error: get(state, "errors.CREATE_OTU_ERROR.message", ""),
    pending: state.otus.createPending,
    refId: state.references.detail.id
});

const mapDispatchToProps = dispatch => ({
    onSubmit: (refId, name, abbreviation) => {
        dispatch(createOTU(refId, name, abbreviation));
    },

    onHide: () => {
        dispatch(pushState({ createOTU: false }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(CreateOTU);
