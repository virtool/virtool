import React from "react";
import { connect } from "react-redux";
import { get } from "lodash-es";
import OTUForm from "../OTUForm";
import { ModalDialog } from "../../../base";
import { editOTU, hideOTUModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { getTargetChange } from "../../../utils/utils";

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
            this.props.onClearError("EDIT_OTU_ERROR");
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleHide = () => {
        this.props.onHide(this.props);
        if (this.props.error) {
            this.props.onClearError("EDIT_OTU_ERROR");
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
            <ModalDialog
                headerText="Edit OTU"
                label="EditOTU"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onHide={this.handleHide}
            >
                <OTUForm
                    name={this.state.name}
                    abbreviation={this.state.abbreviation}
                    error={error}
                    onSubmit={this.handleSubmit}
                    onChange={this.handleChange}
                />
            </ModalDialog>
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

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditOTU);
