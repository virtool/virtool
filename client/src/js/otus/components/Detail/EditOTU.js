import React from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";
import { get } from "lodash-es";
import OTUForm from "../OTUForm";
import { editOTU, hideOTUModal } from "../../actions";
import { clearError } from "../../../errors/actions";
import { getNextState } from "../../otusUtils";
import { getTargetChange } from "../../../utils";

const getInitialState = ({ name = "", abbreviation = "" }) => ({
    name,
    abbreviation,
    errorName: "",
    errorAbbreviation: "",
    error: ""
});

class EditOTU extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        return getNextState(prevState.error, nextProps.error);
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

    handleSave = e => {
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
        return (
            <Modal show={this.props.show} onEnter={this.handleModalEnter} onHide={this.handleHide}>
                <Modal.Header onHide={this.handleHide} closeButton>
                    Edit OTU
                </Modal.Header>
                <OTUForm
                    name={this.state.name}
                    abbreviation={this.state.abbreviation}
                    handleSubmit={this.handleSave}
                    handleChange={this.handleChange}
                    errorName={this.state.errorName}
                    errorAbbreviation={this.state.errorAbbreviation}
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

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditOTU);
