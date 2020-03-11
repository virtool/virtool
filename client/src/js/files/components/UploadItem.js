import React from "react";
import styled from "styled-components";
import { AffixedProgressBar, Icon } from "../../base";
import { byteSize } from "../../utils/utils";

const StyledUploadItem = styled.div`
    padding: 0;
`;

const UploadItemTitle = styled.div`
    align-items: center;
    display: flex;
    padding: 15px 15px 10px;

    i.fas {
        margin-right: 5px;
    }

    span:last-child {
        margin-left: auto;
    }
`;

export const UploadItem = ({ name, progress, size }) => (
    <StyledUploadItem>
        <AffixedProgressBar now={progress} />
        <UploadItemTitle>
            <Icon name="upload" />
            <span>{name}</span>
            <span>{byteSize(size)}</span>
        </UploadItemTitle>
    </StyledUploadItem>
);
