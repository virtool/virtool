import { find, map, toNumber } from "lodash-es";
import React from "react";

import { connect } from "react-redux";
import { Button, DialogBody, DialogFooter, ModalDialog } from "../../../../base";
import { editReference } from "../../../actions";
import { TargetForm } from "./Form";

const getInitialState = ({ name, description, length, required }) => ({
    name: name || "",
    description: description || "",
    length: length || 0,
    required: required || false,
    errorName: ""
});

export class EditTarget extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                errorName: "Required field"
            });
        }

        const targets = map(this.props.targets, target => {
            if (this.props.name === target.name) {
                return {
                    ...target,
                    name: this.state.name,
                    description: this.state.description,
                    length: toNumber(this.state.length),
                    required: this.state.required
                };
            }

            return target;
        });

        this.props.onSubmit(this.props.refId, { targets });
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
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleEnter}
                onExited={this.handleExited}
                label="EditReference"
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <TargetForm
                            onChange={this.handleChange}
                            name={this.state.name}
                            description={this.state.description}
                            length={this.state.length}
                            required={this.state.required}
                            errorName={this.errorName}
                        />
                    </DialogBody>

                    <DialogFooter>
                        <Button type="submit" icon="save" bsStyle="primary">
                            Submit
                        </Button>
                    </DialogFooter>
                </form>
            </ModalDialog>
        );
    }
}

export const mapStateToProps = (state, ownProps) => {
    const activeName = ownProps.activeName;

    let target = {};

    if (activeName) {
        target = find(state.references.detail.targets, { name: activeName }) || {};
    }

    const { name, description, length, required } = target;

    return {
        name,
        description,
        length,
        required,
        targets: state.references.detail.targets,
        refId: state.references.detail.id
    };
};

export const mapDispatchToProps = dispatch => ({
    onSubmit: (refId, update) => {
        dispatch(editReference(refId, update));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditTarget);
