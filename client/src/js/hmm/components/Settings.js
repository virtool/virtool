import React from "react";
import { ViewHeader, ViewHeaderTitle } from "../../base";
import HMMPurge from "./Purge";

const HMMSettings = () => (
    <div>
        <ViewHeader title="HMM Settings">
            <ViewHeaderTitle>HMM Settings</ViewHeaderTitle>
        </ViewHeader>
        <HMMPurge />
    </div>
);

export default HMMSettings;
