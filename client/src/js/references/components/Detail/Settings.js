import React from "react";
import SourceTypes from "../SourceTypes";
import ReferenceMembers from "./Members";
import RemoveReference from "./Remove";

export const ReferenceSettings = ({ isRemote }) => (
    <div className="settings-container">
        {isRemote ? null : <SourceTypes />}
        <ReferenceMembers noun="user" />
        <ReferenceMembers noun="group" />
        <RemoveReference />
    </div>
);
