import React from "react";
import { connect } from "react-redux";
import { Alert, Icon, RemoveBanner } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { purgeHMMs } from "../actions";

export const HMMPurge = ({ canPurge, onPurge }) => {
    if (canPurge) {
        return (
            <RemoveBanner
                message="Delete all HMM profile annotations and data files."
                buttonText="Purge"
                onClick={onPurge}
            />
        );
    }

    return (
        <Alert color="orange" level>
            <Icon name="exclamation-circle" />
            <span>
                <strong>You do not have permission to modify HMMs.</strong>
                <span> Contact an administrator.</span>
            </span>
        </Alert>
    );
};

export const mapStateToProps = state => ({
    canPurge: checkAdminOrPermission(state, "modify_hmm")
});

export const mapDispatchToProps = dispatch => ({
    onPurge: () => {
        dispatch(purgeHMMs());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(HMMPurge);
