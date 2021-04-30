import React from "react";
import { byteSize } from "../../../utils/utils";
import styled from "styled-components";
import { fontWeight } from "../../../app/theme";
import { BoxGroupSection } from "../../../base";

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
