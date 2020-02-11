/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IsolateAdd
 */
import React from "react";
import { connect } from "react-redux";
import { ModalDialog } from "../../../base";
import { editIsolate, hideOTUModal } from "../../actions";
import IsolateForm from "./IsolateForm";

const getInitialState = props => ({
    sourceType: props.sourceType || (props.restrictSourceTypes ? "unknown" : ""),
    sourceName: props.sourceName || ""
});

class EditIsolate extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = update => {
        this.setState(update);
    };

    handleSubmit = e => {
        e.preventDefault();

        this.props.onSave(this.props.otuId, this.props.isolateId, this.state.sourceType, this.state.sourceName);
    };

    render() {
        return (
            <ModalDialog
                headerText="Edit Isolate"
                label="EditIsolate"
                moadlStyle="warning"
                show={this.props.show}
                onEntered={this.modalEntered}
                onHide={this.props.onHide}
            >
                <IsolateForm
                    sourceType={this.state.sourceType}
                    sourceName={this.state.sourceName}
                    allowedSourceTypes={this.props.allowedSourceTypes}
                    restrictSourceTypes={this.props.restrictSourceTypes}
                    onChange={this.handleChange}
                    onSubmit={this.handleSubmit}
                />
            </ModalDialog>
        );
    }
}

const mapStateToProps = state => ({
    show: state.otus.editIsolate,
    allowedSourceTypes: state.references.detail.source_types,
    restrictSourceTypes: state.references.detail.restrict_source_types
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, isolateId, sourceType, sourceName) => {
        dispatch(editIsolate(otuId, isolateId, sourceType, sourceName));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(EditIsolate);
