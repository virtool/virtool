import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { removeSequence, hideOTUModal } from "../../actions";
import { RemoveModal } from "../../../base";

export class RemoveSequence extends React.Component {
    handleConfirm = () => {
        this.props.onConfirm(this.props.otuId, this.props.isolateId, this.props.sequenceId);
    };

    render() {
        const removeMessage = (
            <span>
                Are you sure you want to remove the sequence
                <strong> {this.props.sequenceId}</strong> from
                <strong> {this.props.isolateName}</strong>?
            </span>
        );

        return (
            <RemoveModal
                name={`${this.props.sequenceId}`}
                noun="Sequence"
                onConfirm={this.handleConfirm}
                onHide={this.props.onHide}
                show={!!this.props.sequenceId}
                message={removeMessage}
            />
        );
    }
}

RemoveSequence.propTypes = {
    otuId: PropTypes.string,
    isolateId: PropTypes.string,
    isolateName: PropTypes.string,
    sequenceId: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    onHide: PropTypes.func,
    onConfirm: PropTypes.func
};

const mapStateToProps = state => ({
    sequenceId: state.otus.removeSequence
});

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(hideOTUModal());
    },

    onConfirm: (otuId, isolateId, sequenceId) => {
        dispatch(removeSequence(otuId, isolateId, sequenceId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(RemoveSequence);
