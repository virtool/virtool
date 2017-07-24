/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveSample
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeSample, hideSampleModal } from "../actions";
import { Button } from "virtool/js/components/Base";

const RemoveSample = (props) => (
    <Modal show={props.show} onHide={props.onHide} dialogClassName="modal-danger">
        <Modal.Header onHide={props.onHide} closeButton>
            Remove Virus
        </Modal.Header>
        <Modal.Body>
            Are you sure you want to remove <strong>{props.name}</strong>?
        </Modal.Body>
        <Modal.Footer>
            <Button
                bsStyle="danger"
                icon="checkmark"
                onClick={() => props.onConfirm(props.id, props.onSuccess)}
            >
                Confirm
            </Button>
        </Modal.Footer>
    </Modal>
);

RemoveSample.propTypes = {
    id: PropTypes.string,
    name: PropTypes.string,
    show: PropTypes.bool,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func,
    onSuccess: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        show: state.samples.showRemove
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(hideSampleModal());
        },

        onConfirm: (sampleId, onSuccess) => {
            dispatch(removeSample(sampleId, onSuccess));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveSample);

export default Container;
