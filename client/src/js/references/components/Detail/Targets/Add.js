import React from "react";
import { connect } from "react-redux";
import { Button, ModalDialog, DialogBody, DialogFooter } from "../../../../base";
import { editReference } from "../../../actions";
import { TargetForm } from "./Form";

const getInitialState = () => ({
    name: "",
    description: "",
    length: 0,
    required: false,
    errorName: ""
});

export class AddTarget extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            this.setState({ errorName: "Required Field" });
        }

        const newTarget = [
            ...this.props.targets,
            {
                name: this.state.name,
                description: this.state.description,
                length: new Number(this.state.length),
                required: this.state.required
            }
        ];

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
            [e.target.name]: e.target.value
        });
    };

    handleClick = () => {
        this.setState({
            required: !this.state.required
        });
    };

    handleExited = () => {
        this.props.onHide();
        this.setState(getInitialState());
    };

    render() {
        return (
            <ModalDialog
                submit={this.state.submit}
                label="AddTarget"
                headerText="Add target"
                capitalize="capitalize"
                show={this.props.show}
                onHide={this.props.onHide}
                onEnter={this.handleEnter}
                onExited={this.handleExited}
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
                            onClick={this.handleClick}
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

export const mapStateToProps = state => ({
    names: state.references.detail.name,
    dataType: state.references.detail.data_type,
    documents: state.references.documents,
    refId: state.references.detail.id,
    targets: state.references.detail.targets
});

export const mapDispatchToProps = dispatch => ({
    onSubmit: (refId, update) => {
        dispatch(editReference(refId, update));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddTarget);
