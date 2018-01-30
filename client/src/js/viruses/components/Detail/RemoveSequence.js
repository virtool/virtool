import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeSequence, hideVirusModal } from "../../actions";
import { Button } from "../../../base";

class RemoveSequence extends React.Component {

    handleConfirm = () => {
        this.props.onConfirm(this.props.virusId, this.props.isolateId, this.props.sequenceId, this.props.onSuccess);
    };

    render () {
        return (
            <Modal show={Boolean(this.props.sequenceId)} onHide={this.props.onHide} dialogClassName="modal-danger">
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Remove Sequence
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to remove the sequence <strong>{this.props.sequenceId}</strong> from
                    <strong> {this.props.isolateName}</strong>?
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        bsStyle="danger"
                        icon="checkmark"
                        onClick={this.handleConfirm}
                    >
                        Confirm
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}

RemoveSequence.propTypes = {
    virusId: PropTypes.string,
    isolateId: PropTypes.string,
    isolateName: PropTypes.string,
    sequenceId: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    onHide: PropTypes.func,
    onConfirm: PropTypes.func,
    onSuccess: PropTypes.func
};

const mapStateToProps = state => ({
    sequenceId: state.viruses.removeSequence
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onConfirm: (virusId, isolateId, onSuccess) => {
        dispatch(removeSequence(virusId, isolateId, onSuccess));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveSequence);

export default Container;
