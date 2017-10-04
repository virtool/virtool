/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveIsolate
 */

import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeVirus, hideVirusModal } from "../../actions";
import { Button } from "../../../base";

const RemoveVirus = (props) => {
    return (
        <Modal show={props.show} onHide={props.onHide} dialogClassName="modal-danger">
            <Modal.Header onHide={props.onHide} closeButton>
                Remove Virus
            </Modal.Header>
            <Modal.Body>
                Are you sure you want to remove <strong>{props.virusName}</strong>?
            </Modal.Body>
            <Modal.Footer>
                <Button
                    bsStyle="danger"
                    icon="checkmark"
                    onClick={() => props.onConfirm(props.virusId, props.history)}
                >
                    Confirm
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

RemoveVirus.propTypes = {
    history: PropTypes.object,
    show: PropTypes.bool,
    virusId: PropTypes.string,
    virusName: PropTypes.string,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        show: state.viruses.remove,
        virusId: state.viruses.detail.id,
        virusName: state.viruses.detail.name
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onHide: () => {
            dispatch(hideVirusModal());
        },

        onConfirm: (virusId, history) => {
            dispatch(removeVirus(virusId, history));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveVirus);

export default Container;
