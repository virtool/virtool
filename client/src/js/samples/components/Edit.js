import { get, pick } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import {
    DialogBody,
    DialogFooter,
    Input,
    InputError,
    InputGroup,
    InputLabel,
    ModalDialog,
    SaveButton
} from "../../base";
import { clearError } from "../../errors/actions";

import { editSample } from "../actions";

const getInitialState = ({ name, isolate, host, locale }) => ({
    name: name || "",
    isolate: isolate || "",
    host: host || "",
    locale: locale || "",
    error: ""
});

class EditSample extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });

        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleModalHide = () => {
        if (this.props.error) {
            this.props.onClearError();
        }
        this.props.onHide();
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                error: "Required Field"
            });
        }

        this.props.onEdit(this.props.id, pick(this.state, ["name", "isolate", "host", "locale"]));
    };

    render() {
        const error = this.state.error || this.props.error || "";

        return (
            <ModalDialog
                label="EditSample"
                headerText="Edit Sample"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onHide={this.handleModalHide}
            >
                <form onSubmit={this.handleSubmit}>
                    <DialogBody>
                        <InputGroup>
                            <InputLabel>Name</InputLabel>
                            <Input name="name" value={this.state.name} onChange={this.handleChange} />
                            <InputError>{error}</InputError>
                        </InputGroup>
                        <InputGroup>
                            <InputLabel>Isolate</InputLabel>
                            <Input name="isolate" value={this.state.isolate} onChange={this.handleChange} />
                        </InputGroup>
                        <InputGroup>
                            <InputLabel>Host</InputLabel>
                            <Input name="host" value={this.state.host} onChange={this.handleChange} />
                        </InputGroup>
                        <InputGroup>
                            <InputLabel>Locale</InputLabel>
                            <Input name="locale" value={this.state.locale} onChange={this.handleChange} />
                        </InputGroup>
                    </DialogBody>
                    <DialogFooter>
                        <SaveButton />
                    </DialogFooter>
                </form>
            </ModalDialog>
        );
    }
}

const mapStateToProps = state => ({
    ...state.samples.detail,
    show: get(state.router.location.state, "editSample", false),
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ showEdit: false }));
    },

    onEdit: (sampleId, update) => {
        dispatch(editSample(sampleId, update));
    },

    onClearError: () => {
        dispatch(clearError("UPDATE_SAMPLE_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditSample);
