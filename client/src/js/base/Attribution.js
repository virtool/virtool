import React from "react";
import styled from "styled-components";
import { RelativeTime } from "./RelativeTime";
import { Identicon } from "./Identicon";

const StyledPortrait = styled.img`
    border-radius: 10px;
    height: 16px;
`;

export const Portrait = ({ gravatar }) => (
    <StyledPortrait alt="" src={`https://s.gravatar.com/avatar/${gravatar}?s=80`} />
);

const StyledAttribution = styled.div`
    align-items: center;
    display: flex;
    font-size: inherit;

    *:not(:first-child) {
        margin-left: 3px;
    }
`;

export const Attribution = ({ time, user, identicon, verb = "created" }) => {
    return (
        <StyledAttribution>
            <Identicon size={12} hash={identicon} />
            <span>{user}</span>
            <span>{verb}</span>
            <RelativeTime time={time} />
        </StyledAttribution>
    );
};
