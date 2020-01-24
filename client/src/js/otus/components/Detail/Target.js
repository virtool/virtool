import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Button, Badge } from "../../../base";

const TargetLine = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 91px;
`;

const RequiredLength = styled.div`
    display: flex;
    justify-content: space-between;
    margin-left: 10px;
    div {
        color: ${props => props.theme.color.red};
        font-weight: bold;
    }
`;

export const TargetComponent = props => {
    const lengthSection = props.length ? <Badge>{props.length}</Badge> : "";
    const description = props.description ? <span>{props.description}</span> : <span>No description</span>;
    return (
        <div>
            <TargetLine>
                <span>{props.name}</span>
                <RequiredLength>
                    <div>{props.required}</div>
                    {lengthSection}
                </RequiredLength>
            </TargetLine>
            {description}
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
            <TargetComponent {...props} />

            <AddButton>
                <Button onClick={props.onClick}>Add</Button>
            </AddButton>
        </BoxGroupSection>
    );
};
