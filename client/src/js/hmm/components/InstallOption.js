import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Alert, Button, Icon } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { installHMMs } from "../actions";

export const InstallOption = ({ canInstall, onInstall, releaseId }) => {
    if (canInstall) {
        return (
            <Button icon="download" onClick={() => onInstall(releaseId)}>
                Install Official
            </Button>
        );
    }

    return (
        <Alert color="orange" level>
            <Icon name="exclamation-circle" />
            <span>
                <strong>You do not have permission to install HMMs.</strong>
                <span> Contact an administrator.</span>
            </span>
        </Alert>
    );
};

export const mapStateToProps = state => ({
    canInstall: checkAdminOrPermission(state, "modify_hmm"),
    releaseId: get(state.hmms.status, "release.id")
});

export const mapDispatchToProps = dispatch => ({
    onInstall: releaseId => {
        dispatch(installHMMs(releaseId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(InstallOption);
