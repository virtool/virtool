import React from "react";
import styled from "styled-components";
import { BoxGroupSection } from "../../../base";
import { byteSize } from "../../../utils/utils";
import { fontWeight } from "../../../app/theme";

const StyledBoxGroupSection = styled(BoxGroupSection)`
    align-items: center;
    display: flex;

    a {
        margin-right: auto;
        font-weight: ${fontWeight.thick};
    }
`;

export const SubtractionFile = ({ file: { download_url, name, size } }) => (
    <StyledBoxGroupSection>
        <a href={download_url}>{name}</a>
        <strong>{byteSize(size)}</strong>
    </StyledBoxGroupSection>
);
