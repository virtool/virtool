import React from "react";
import { connect } from "react-redux";
import { DialogBody, DialogFooter, Input, InputGroup, InputLabel, ModalDialog, SaveButton } from "../../base";
import { updateSubtraction } from "../actions";

export class EditSubtraction extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            nickname: props.nickname
        };
    }

    handleSubmit = e => {
        e.preventDefault();
        this.props.onUpdate(this.props.id, this.state.nickname);
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
                            <InputLabel>Nickname</InputLabel>
                            <Input
                                value={this.state.nickname}
                                onChange={e => this.setState({ nickname: e.target.value })}
                            />
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
    const { id, nickname } = state.subtraction.detail;
    return { id, nickname };
};

export const mapDispatchToProps = dispatch => ({
    onUpdate: (id, nickname) => {
        dispatch(updateSubtraction(id, nickname));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditSubtraction);
