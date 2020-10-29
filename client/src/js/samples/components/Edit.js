import { get, pick } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { TextArea } from "../../base/TextArea";
import { ReleaseMarkdown } from "../../updates/components/Markdown";
import { Button } from "../../base/Button";
import { NotesBox } from "../../base/Box";
import {
    ModalBody,
    ModalFooter,
    Input,
    InputError,
    InputGroup,
    InputLabel,
    NotesLabel,
    Modal,
    SaveButton,
    ModalHeader
} from "../../base";
import { clearError } from "../../errors/actions";
import { editSample } from "../actions";

const getInitialState = ({ name, isolate, host, locale, notes, isPreview }) => ({
    name: name || "",
    isolate: isolate || "",
    host: host || "",
    locale: locale || "",
    notes: notes || "",
    isPreview: isPreview || false,
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

    handleModalExited = () => {
        if (this.props.error) {
            this.props.onClearError();
        }
    };

    handlePreview = e => {
        this.setState({ isPreview: e });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (!this.state.name) {
            return this.setState({
                error: "Required Field"
            });
        }

        this.props.onEdit(this.props.id, pick(this.state, ["name", "isolate", "host", "locale", "notes"]));
    };

    render() {
        const error = this.state.error || this.props.error || "";
        const isPreview = this.state.isPreview;
        const notes = this.state.notes;
        return (
            <Modal
                label="Edit Sample"
                show={this.props.show}
                onEnter={this.handleModalEnter}
                onExited={this.handleModalExited}
                onHide={this.props.onHide}
            >
                <ModalHeader>Edit Sample</ModalHeader>
                <form onSubmit={this.handleSubmit}>
                    <ModalBody>
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
                        <InputGroup classname="mark-input">
                            <NotesLabel>Notes</NotesLabel>
                            <Button onClick={() => this.handlePreview(false)}>Write</Button>
                            <Button onClick={() => this.handlePreview(true)}>Preview</Button>
                            {isPreview ? (
                                <NotesBox>
                                    <ReleaseMarkdown
                                        body={notes ? notes : "Edit the sample to add additional notes."}
                                    ></ReleaseMarkdown>
                                </NotesBox>
                            ) : (
                                <TextArea
                                    name="notes"
                                    value={this.state.notes}
                                    onChange={this.handleChange}
                                    className="input"
                                />
                            )}
                        </InputGroup>
                    </ModalBody>
                    <ModalFooter>
                        <SaveButton />
                    </ModalFooter>
                </form>
            </Modal>
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
