/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveSubtraction
 */

import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Modal } from "react-bootstrap";

import { removeSubtraction } from "../actions";
import { Button } from "../../base";

const RemoveSubtraction = (props) => (
    <Modal show={props.show} onHide={props.onHide} dialogClassName="modal-danger">
        <Modal.Header onHide={props.onHide} closeButton>
            Remove Subtraction
        </Modal.Header>
        <Modal.Body>
            Are you sure you want to remove <strong>{props.id}</strong>?
        </Modal.Body>
        <Modal.Footer>
            <Button
                bsStyle="danger"
                icon="checkmark"
                onClick={() => props.onConfirm(props.id)}
            >
                Confirm
            </Button>
        </Modal.Footer>
    </Modal>
);

RemoveSubtraction.propTypes = {
    id: PropTypes.string,
    show: PropTypes.bool,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        show: !!state.router.location.state && state.router.location.state.removeSubtraction
    }
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(push({state: {removeSubtraction: false}}));
        },

        onConfirm: (subtractionId) => {
            dispatch(removeSubtraction(subtractionId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveSubtraction);

export default Container;

