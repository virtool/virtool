import React from "react";
import { ViewHeader } from "../../base";
import HMMPurge from "./Purge";

const HMMSettings = () => (
    <div>
        <ViewHeader title="Settings - HMMs">
            <strong>HMM Settings</strong>
        </ViewHeader>

        <HMMPurge />
    </div>
);

export default HMMSettings;
