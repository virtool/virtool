import { capitalize } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { RelativeTime } from "./RelativeTime";
import { Identicon } from "./Identicon";

export const UnstyledAttribution = ({ className, time, user, identicon, verb = "created" }) => {
    return (
        <span className={className}>
            {identicon ? <Identicon size={12} hash={identicon} /> : null}
            <span>{user}</span>
            <span>{user ? verb : capitalize(verb)}</span>
            <RelativeTime time={time} />
        </span>
    );
};

export const Attribution = styled(UnstyledAttribution)`
    align-items: center;
    display: inline-flex;
    font-size: inherit;

    *:not(:first-child) {
        margin-left: 3px;
    }
`;
