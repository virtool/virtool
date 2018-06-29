import React from "react";
import { connect } from "react-redux";
import { Button, ViewHeader, Alert } from "../../base";
import { purgeHMMs } from "../actions";

export const HMMSettings = ({ onPurge }) => (
    <div>
        <ViewHeader title="Settings - HMMs">
            <strong>HMM Settings</strong>
        </ViewHeader>

        <Alert bsStyle="danger">
            <div style={{ textAlign: "right" }}>
                <span style={{ float: "left", marginTop: "7px" }}>
                    Delete all HMM profile annotations and data files.
                </span>
                <Button bsStyle="danger" onClick={onPurge}>
                    Purge
                </Button>
            </div>
        </Alert>
    </div>
);

const mapDispatchToProps = (dispatch) => ({
    onPurge: () => {
        dispatch(purgeHMMs());
    }
});

export default connect(() => ({}), mapDispatchToProps)(HMMSettings);
