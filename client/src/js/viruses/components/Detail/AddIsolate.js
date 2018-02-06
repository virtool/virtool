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

import { addIsolate, hideVirusModal } from "../../actions";
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
        virusId: PropTypes.string,
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
        this.props.onSave(this.props.virusId, this.state.sourceType, this.state.sourceName);
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
                        onSubmit={this.handleSubmit}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button bsStyle="primary" icon="floppy" onClick={this.save}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

const mapStateToProps = state => ({
    show: state.viruses.addIsolate,
    allowedSourceTypes: state.settings.data.allowed_source_types,
    restrictSourceTypes: state.settings.data.restrict_source_types
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onSave: (virusId, sourceType, sourceName) => {
        dispatch(addIsolate(virusId, sourceType, sourceName));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(AddIsolate);

export default Container;
