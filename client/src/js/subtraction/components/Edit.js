import React from "react";
import { connect } from "react-redux";
import { DialogBody, DialogFooter, Input, InputGroup, InputLabel, ModalDialog, SaveButton } from "../../base";
import { editSubtraction } from "../actions";

export class EditSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            error: "",
            name: props.name,
            nickname: props.nickname
        };
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value
        });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.name === "") {
            return setState({
                error: "A name must be provided"
            });
        }

        this.props.onUpdate(this.props.id, this.state.name, this.state.nickname);
        this.props.onHide();
    };

    render() {
        return (
            <ModalDialog
                label="SubtractionEdit"
                headerText="Edit Subtraction"
                show={this.props.show}
                onHide={this.props.onHide}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Input name="name" value={this.state.name} onChange={this.handleChange} />
                        </InputGroup>
                        <InputGroup>
                            <InputLabel>Nickname</InputLabel>
                            <Input name="nickname" value={this.state.nickname} onChange={this.handleChange} />
                        </InputGroup>
                    </DialogBody>

                    <DialogFooter className="modal-footer">
                        <SaveButton pullRight />
                    </DialogFooter>
                </form>
            </ModalDialog>
        );
    }
}

export const mapStateToProps = state => {
    const { id, name, nickname } = state.subtraction.detail;
    return { id, name, nickname };
};

export const mapDispatchToProps = dispatch => ({
    onUpdate: (id, name, nickname) => {
        dispatch(editSubtraction(id, name, nickname));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditSubtraction);
