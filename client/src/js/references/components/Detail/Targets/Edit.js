import React from "react";

import { connect } from "react-redux";
import { findIndex, find } from "lodash-es";
import { Button, ModalDialog, DialogBody, DialogFooter } from "../../../../base";
import { editReference } from "../../../actions";
import { TargetForm } from "./Form";

const getInitialState = ({ initialName, initialDescription, initialLength, initialRequired }) => ({
    name: initialName || "",
    description: initialDescription || "",
    length: initialLength || 0,
    required: initialRequired || false,
    errorName: ""
});

export class EditTarget extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleSubmit = e => {
        e.preventDefault();

        const targets = this.props.targets;
        const initialTarget = this.props.initialTarget;
        const newTarget = [...this.props.targets];
        newTarget.splice(findIndex(targets, initialTarget), 1, {
            name: this.state.name,
            description: this.state.description,
            length: new Number(this.state.length),
            required: this.state.required
        });

        const update = {
            targets: newTarget
        };

        if (this.state.name) {
            this.props.onSubmit(this.props.refId, update);
        }
        this.props.onHide();
    };

    handleChange = e => {
        this.setState({
            [e.target.name]: e.target.value,
            required: e.target.checked
        });
    };

    handleEnter = () => {
        this.setState(getInitialState(this.props));
    };

    render() {
        return (
            <ModalDialog
                headerText="Edit target"
                text-capitalize="text-capitalize"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleEnter}
                onExited={this.handleExited}
            >
                <DialogBody>
                    <form onSubmit={this.handleSubmit}>
                        <TargetForm
                            onChange={this.handleChange}
                            name={this.state.name}
                            description={this.state.description}
                            length={this.state.length}
                            required={this.state.required}
                            errorName={this.errorName}
                        />
                        <DialogFooter>
                            <Button type="submit" icon="save" bsStyle="primary">
                                Submit
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogBody>
            </ModalDialog>
        );
    }
}

export const mapStateToProps = (state, ownProps) => {
    const activeName = ownProps.activeName;

    let initialTarget = {};

    if (activeName) {
        initialTarget = find(state.references.detail.targets, ["name", ownProps.activeName]);
        if (!initialTarget) {
            initialTarget = {};
        }
    }

    const { name, description, length, required } = initialTarget;

    return {
        initialTarget,
        targets: state.references.detail.targets,
        initialName: name,
        initialDescription: description,
        initialLength: length,
        initialRequired: required,
        refId: state.references.detail.id
    };
};

export const mapDispatchToProps = dispatch => ({
    onSubmit: (refId, update) => {
        dispatch(editReference(refId, update));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditTarget);
