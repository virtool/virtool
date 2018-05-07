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
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { addIsolate, hideOTUModal } from "../../actions";
import { Button } from "../../../base";
import IsolateForm from "./IsolateForm";

const getInitialState = (props) => ({
    sourceType: props.restrictSourceTypes ? "unknown" : "",
    sourceName: ""
});

class AddIsolate extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    static propTypes = {
        OTUId: PropTypes.string,
        allowedSourceTypes: PropTypes.array,
        restrictSourceTypes: PropTypes.bool,
        show: PropTypes.bool,
        onHide: PropTypes.func,
        onSave: PropTypes.func
    };

    handleChange = (update) => {
        this.setState(update);
    };

    handleSubmit = () => {
        this.props.onSave(this.props.OTUId, this.state.sourceType, this.state.sourceName);
    };

    render () {
        return (
            <Modal show={this.props.show} onEntered={this.handleModalEntered} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Add Isolate
                </Modal.Header>
                <Modal.Body>
                    <IsolateForm
                        ref={(node) => this.formNode = node}
                        sourceType={this.state.sourceType}
                        sourceName={this.state.sourceName}
                        allowedSourceTypes={this.props.allowedSourceTypes}
                        restrictSourceTypes={this.props.restrictSourceTypes}
                        onChange={this.handleChange}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" icon="floppy" onClick={this.handleSubmit}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: state.OTUs.addIsolate,
    allowedSourceTypes: state.settings.data.allowed_source_types,
    restrictSourceTypes: state.settings.data.restrict_source_types
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideOTUModal());
    },

    onSave: (OTUId, sourceType, sourceName) => {
        dispatch(addIsolate(OTUId, sourceType, sourceName));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(AddIsolate);
