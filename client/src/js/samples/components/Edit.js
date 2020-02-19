import { get, pick } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { pushState } from "../../app/actions";
import { InputError, SaveButton, ModalDialog, DialogBody, DialogFooter } from "../../base";
import { clearError } from "../../errors/actions";

import { editSample } from "../actions";

const EditSampleHostLocale = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-column-gap: 13px;
`;

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

    static getDerivedStateFromProps(nextProps, prevState) {
        if (prevState.error !== nextProps.error) {
            return { error: nextProps.error };
        }
        return null;
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });

        if (this.props.error) {
            this.props.onClearError("UPDATE_SAMPLE_ERROR");
        }
    };

    handleModalEnter = () => {
        this.setState(getInitialState(this.props));
    };

    handleModalHide = () => {
        if (this.props.error) {
            this.props.onClearError("UPDATE_SAMPLE_ERROR");
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
                        <InputError
                            label="Name"
                            name="name"
                            value={this.state.name}
                            onChange={this.handleChange}
                            error={this.state.error}
                        />
                        <EditSampleHostLocale>
                            <InputError
                                label="Isolate"
                                name="isolate"
                                value={this.state.isolate}
                                onChange={this.handleChange}
                            />
                            <InputError label="Host" name="host" value={this.state.host} onChange={this.handleChange} />

                            <InputError
                                name="locale"
                                label="Locale"
                                value={this.state.locale}
                                onChange={this.handleChange}
                            />
                        </EditSampleHostLocale>
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

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditSample);
