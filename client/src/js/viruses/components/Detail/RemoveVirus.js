import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeVirus, hideVirusModal } from "../../actions";
import { Button } from "../../../base";

class RemoveVirus extends React.Component {

    handleConfirm = () => {
        this.props.onConfirm(this.props.virusId, this.props.history);
    }

    render () {
        return (
            <Modal show={this.props.show} onHide={this.props.onHide} dialogClassName="modal-danger">
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Remove Virus
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to remove <strong>{this.props.virusName}</strong>?
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

RemoveVirus.propTypes = {
    history: PropTypes.object,
    show: PropTypes.bool,
    virusId: PropTypes.string,
    virusName: PropTypes.string,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func
};

const mapStateToProps = state => ({
    show: state.viruses.remove
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideVirusModal());
    },

    onConfirm: (virusId, history) => {
        dispatch(removeVirus(virusId, history));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(RemoveVirus);

export default Container;
