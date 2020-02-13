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
import { addIsolate, hideOTUModal } from "../../actions";
import IsolateForm from "./IsolateForm";

const getInitialState = props => ({
    sourceType: props.restrictSourceTypes ? "unknown" : "",
    sourceName: ""
});

class AddIsolate extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = update => {
        this.setState(update);
    };

    handleSubmit = e => {
        e.preventDefault();

        const sourceType = this.state.sourceType || "unknown";

        const sourceName = sourceType === "unknown" ? "" : this.state.sourceName;

        this.props.onSave(this.props.otuId, sourceType, sourceName);
    };

    handleExit = () => {
        this.setState(getInitialState(this.props));
    };

    render() {
        return (
            <ModalDialog
                label="AddIsolate"
                headerText="Add Isolate"
                show={this.props.show}
                onHide={this.props.onHide}
                onExited={this.handleExit}
            >
                <IsolateForm
                    ref={node => (this.formNode = node)}
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
    show: state.otus.addIsolate,
    otuId: state.otus.detail.id,
    allowedSourceTypes: state.references.detail.source_types,
    restrictSourceTypes: state.references.detail.restrict_source_types
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (otuId, sourceType, sourceName) => {
        dispatch(addIsolate(otuId, sourceType, sourceName));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddIsolate);
