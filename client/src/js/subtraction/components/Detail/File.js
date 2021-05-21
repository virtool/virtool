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

export const SubtractionFile = ({ file }) => {
    return (
        <StyledBoxGroupSection>
            <a href={file.download_url}>{file.name}</a>
            <strong>{byteSize(file.size)}</strong>
        </StyledBoxGroupSection>
    );
};
