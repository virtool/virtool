import React from "react";
import styled from "styled-components";
import { ExternalLink } from "../../../base";

const StyledNuVsORFLabel = styled.span`
    text-transform: capitalize;
`;

export const NuVsORFLabel = ({ hmm }) => {
    if (hmm) {
        return (
            <StyledNuVsORFLabel as={ExternalLink} href={`/hmm/${hmm.hit}`}>
                {hmm.names[0]}
            </StyledNuVsORFLabel>
        );
    }

    return <StyledNuVsORFLabel>Unannotated</StyledNuVsORFLabel>;
};
