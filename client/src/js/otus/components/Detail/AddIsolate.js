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
        otuId: PropTypes.string,
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
        this.props.onSave(this.props.otuId, this.state.sourceType, this.state.sourceName);
    };

    handleExit = () => {
        this.setState(getInitialState(this.props));
    };

    render () {
        return (
            <Modal
                show={this.props.show}
                onEntered={this.handleModalEntered}
                onHide={this.props.onHide}
                onExited={this.handleExit}
            >
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
    show: state.otus.addIsolate,
    allowedSourceTypes: state.settings.data.allowed_source_types,
    restrictSourceTypes: state.settings.data.restrict_source_types
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
