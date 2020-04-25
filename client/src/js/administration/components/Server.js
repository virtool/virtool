import React from "react";
import { NarrowContainer } from "../../base";
import Sentry from "./Sentry";
import API from "./API";

export const ServerSettings = () => (
    <React.Fragment>
        <NarrowContainer>
            <Sentry />
        </NarrowContainer>
        <NarrowContainer>
            <API />
        </NarrowContainer>
    </React.Fragment>
);
