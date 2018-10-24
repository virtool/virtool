import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { removeOTU, hideOTUModal } from "../../actions";
import { RemoveModal } from "../../../base";

class RemoveOTU extends React.Component {
  handleConfirm = () => {
    this.props.onConfirm(
      this.props.refDetail.id,
      this.props.otuId,
      this.props.history
    );
  };

  render() {
    return (
      <RemoveModal
        name={this.props.otuName}
        noun="OTU"
        onConfirm={this.handleConfirm}
        onHide={this.props.onHide}
        show={this.props.show}
      />
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

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RemoveOTU);
