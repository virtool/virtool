import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../../app/actions";
import { SaveButton, ModalDialog, DialogFooter, DialogBody } from "../../../base";
import { clearError } from "../../../errors/actions";
import { getTargetChange, routerLocationHasState } from "../../../utils/utils";
import { editReference } from "../../actions";
import { ReferenceForm } from "../Form";

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
            <ModalDialog
                label="Edit"
                headerText="Edit Reference"
                show={this.props.show}
                onHide={this.handleHide}
                onEnter={this.handleModalEnter}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <ReferenceForm
                            description={this.state.description}
                            organism={this.state.organism}
                            mode={this.state.mode}
                            name={this.state.name}
                            errorFile={this.state.errorFile}
                            errorName={this.state.errorSelect}
                            errorSelect={this.state.errorSelect}
                            onChange={this.handleChange}
                        />
                    </DialogBody>

                    <DialogFooter>
                        <SaveButton pullRight />
                    </DialogFooter>
                </form>
            </ModalDialog>
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
        dispatch(pushState({ editReference: false }));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditReference);
