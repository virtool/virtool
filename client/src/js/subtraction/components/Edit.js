import React from "react";
import { connect } from "react-redux";
import { updateSubtraction } from "../actions";
import { SaveButton, InputError, ModalDialog, DialogFooter, DialogBody } from "../../base";

const getInitialState = props => ({
    subtractionId: props.entry.id,
    fileId: props.entry.file.name,
    nickname: props.entry.nickname
});

export class EditSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleSubmit = e => {
        e.preventDefault();
        this.props.onUpdate(this.state.subtractionId, this.state.nickname);
        this.props.exited();
    };

    render() {
        return (
            <ModalDialog
                label="SubtractionEdit"
                headerText="Edit Subtraction"
                show={this.props.show}
                onHide={this.props.exited}
                onExited={this.props.exited}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody style={{ margin: "0 0 10px 0" }}>
                        <InputError type="text" label="Unique Name" value={this.state.subtractionId} readOnly />

                        <InputError
                            type="text"
                            label="Nickname"
                            value={this.state.nickname}
                            onChange={e => this.setState({ nickname: e.target.value })}
                        />

                        <InputError type="text" label="File" value={this.state.fileId} readOnly />
                    </DialogBody>

                    <DialogFooter className="modal-footer">
                        <SaveButton pullRight />
                    </DialogFooter>
                </form>
            </ModalDialog>
        );
    }
}

export const mapDispatchToProps = dispatch => ({
    onUpdate: (id, nickname) => {
        dispatch(updateSubtraction(id, nickname));
    }
});

export default connect(null, mapDispatchToProps)(EditSubtraction);
