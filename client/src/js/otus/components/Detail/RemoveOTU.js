import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Modal } from "react-bootstrap";

import { removeOTU, hideOTUModal } from "../../actions";
import { Button } from "../../../base";

class RemoveOTU extends React.Component {

    handleConfirm = () => {
        this.props.onConfirm(this.props.refDetail.reference.id, this.props.otuId, this.props.history);
    }

    render () {
        return (
            <Modal show={this.props.show} onHide={this.props.onHide} dialogClassName="modal-danger">
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Remove OTU
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to remove <strong>{this.props.otuName}</strong>?
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

RemoveOTU.propTypes = {
    history: PropTypes.object,
    show: PropTypes.bool,
    otuId: PropTypes.string,
    otuName: PropTypes.string,
    onHide: PropTypes.func,
    onConfirm: PropTypes.func,
    refDetail: PropTypes.object
};

const mapStateToProps = state => ({
    show: state.otus.remove,
    refDetail: state.references.detail
});

const mapDispatchToProps = dispatch => ({

    onHide: () => {
        dispatch(hideOTUModal());
    },

    onConfirm: (refId, otuId, history) => {
        dispatch(removeOTU(refId, otuId, history));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(RemoveOTU);
