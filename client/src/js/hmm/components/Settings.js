import React from "react";
import { connect } from "react-redux";
import { Button, ViewHeader } from "../../base";
import { purgeHMMs } from "../actions";

export const HMMSettings = ({ onPurge }) => (
    <div>
        <ViewHeader title="HMM Settings" />

        <Button onClick={onPurge}>
            Purge
        </Button>
    </div>
);

const mapDispatchToProps = (dispatch) => ({
    onPurge: () => {
        dispatch(purgeHMMs());
    }
});

export default connect(() => ({}), mapDispatchToProps)(HMMSettings);
