import React from "react";
import { connect } from "react-redux";
import { ViewHeader, Alert, RemoveBanner } from "../../base";
import { purgeHMMs } from "../actions";
import { checkAdminOrPermission } from "../../utils";

export const HMMSettings = ({ canPurge, onPurge }) => (
  <div>
    <ViewHeader title="Settings - HMMs">
      <strong>HMM Settings</strong>
    </ViewHeader>

    {canPurge ? (
      <RemoveBanner
        message="Delete all HMM profile annotations and data files."
        buttonText="Purge"
        onClick={onPurge}
      />
    ) : (
      <Alert bsStyle="warning" icon="exclamation-circle">
        <strong>You do not have permission to modify HMMs.</strong>
        <span> Contact an administrator.</span>
      </Alert>
    )}
  </div>
);

const mapStateToProps = state => ({
  canPurge: checkAdminOrPermission(
    state.account.administrator,
    state.account.permissions,
    "modify_hmm"
  )
});

const mapDispatchToProps = dispatch => ({
  onPurge: () => {
    dispatch(purgeHMMs());
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(HMMSettings);
