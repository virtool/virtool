import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Modal, ModalHeader } from "../../../base";
import { clearError } from "../../../errors/actions";
import { getTargetChange } from "../../../utils/utils";
import { editOTU, hideOTUModal } from "../../actions";
import { OTUForm } from "../Form";

const getInitialState = ({ name = "", abbreviation = "" }) => ({
    name,
    abbreviation,
    error: ""
});

class EditOTU extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    handleChange = e => {
        const { name, value, error } = getTargetChange(e.target);

        this.setState({
            [name]: value,
            [error]: ""
        });

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleModalExited = () => {
        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                errorName: "Required Field"
            });
        }

        if (!this.state.error) {
            this.props.onSave(this.props.otuId, this.state.name, this.state.abbreviation);
        }
    };

    render() {
        const error = this.state.error || this.props.error || "";

        return (
            <Modal
                label="Edit OTU"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
                onHide={this.props.onHide}
            >
                <ModalHeader>Edit OTU</ModalHeader>
                <OTUForm
                    name={this.state.name}
                    abbreviation={this.state.abbreviation}
                    error={error}
                    onSubmit={this.handleSubmit}
                    onChange={this.handleChange}
                />
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: state.otus.edit,
    error: get(state, "errors.EDIT_OTU_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, name, abbreviation) => {
        dispatch(editOTU(otuId, name, abbreviation));
    },

    onClearError: () => {
        dispatch(clearError("EDIT_OTU_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditOTU);
