import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Button, Badge } from "../../../base";

const TargetInfoHeader = styled.h4`
    align-items: center;
    display: flex;
    font-size: ${props => props.theme.fontSize.md};
    margin: 0;

    & > span:first-child {
        font-weight: bold;
        min-width: 200px;
        max-width: 300px;
    }
`;

const TargetInfoLength = styled(Badge)`
    margin-left: auto;
`;

const TargetInfoRequired = styled.span`
    color: ${props => props.theme.color.red};
    font-weight: bold;
`;

export const TargetInfo = ({ description, length, name, required }) => {
    let lengthComponent;

    if (length) {
        lengthComponent = <TargetInfoLength>{length}</TargetInfoLength>;
    }

    const descriptionComponent = description ? <span>{description}</span> : <span>No description</span>;

    return (
        <div>
            <TargetInfoHeader>
                <span>{name}</span>
                <TargetInfoRequired required={required}>{required}</TargetInfoRequired>
                <TargetInfoLength>{lengthComponent}</TargetInfoLength>
            </TargetInfoHeader>
            {descriptionComponent}
        </div>
    );
};

const AddButton = styled.div`
    display: flex;
    justify-content: center;
    padding-top: 15px;
`;

export const Target = props => {
    return (
        <BoxGroupSection>
            <TargetInfo {...props} />

            <AddButton>
                <Button onClick={props.onClick}>Add</Button>
            </AddButton>
        </BoxGroupSection>
    );
};
