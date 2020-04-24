import React from "react";
import styled from "styled-components";
import { CloseButton, Icon } from "../../../../base";

const SequenceHeaderButtons = styled.span`
    align-items: center;
    display: flex;
    margin-left: auto;
    padding-left: 20px;

    button {
        margin-left: 2px;
    }

    i.fas {
        font-size: 16px;
        margin-right: 5px;
    }

    > :last-child {
        margin-left: 20px;
    }
`;

export const SequenceButtons = ({ canModify, onCollapse, onDownload, onShowEdit, onShowRemove }) => (
    <SequenceHeaderButtons>
        {canModify && <Icon name="pencil-alt" color="orange" tip="Edit Sequence" onClick={onShowEdit} />}
        {canModify && <Icon name="trash" color="red" tip="Remove Sequence" onClick={onShowRemove} />}
        <Icon name="download" tip="Download FASTA" onClick={onDownload} />
        <CloseButton onClick={onCollapse} />
    </SequenceHeaderButtons>
);
