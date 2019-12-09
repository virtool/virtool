import React from "react";
import Sentry from "./Sentry";
import API from "./API";

export const ServerSettings = () => (
    <div>
        <div className="settings-container">
            <Sentry />
        </div>
        <div className="settings-container">
            <API />
        </div>
    </div>
);
