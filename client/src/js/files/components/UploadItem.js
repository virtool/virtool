import React from "react";
import styled from "styled-components";
import { AffixedProgressBar } from "../../base";

const StyledUploadItem = styled.div`
    padding: 0;
`;

const UploadItemTitle = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
`;

export const UploadItem = ({ name, progress }) => (
    <StyledUploadItem>
        <AffixedProgressBar now={progress} />
        <UploadItemTitle>{name}</UploadItemTitle>
    </StyledUploadItem>
);
