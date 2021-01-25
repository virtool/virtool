import React, { useCallback } from "react";
import styled from "styled-components";
import { Label, LinkIcon, BoxGroupSection } from "../../base";

const getContrastColor = props => {
    const red = parseInt(props.color.substr(1, 2), 16);
    const green = parseInt(props.color.substr(3, 2), 16);
    const blue = parseInt(props.color.substr(5, 2), 16);
    const yiq = (red * 299 + green * 587 + blue * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
};

const LabelItemExampleContainer = styled.div`
    min-width: 30%;
`;

const LabelItemExample = styled(Label)`
    font-size: ${props => props.theme.fontSize.lg};
    background-color: ${props => props.color};
    color: ${getContrastColor};
`;

const LabelRow = styled(BoxGroupSection)`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-start;
`;

const IconFlex = styled.div`
    align-self: flex-end;
    margin-left: auto;
`;
const LabelIcon = styled(LinkIcon)`
    margin: 0 5px;
    font-size: 20px;
`;

const Description = styled.p`
    margin: 5px 8px;
`;

export const LabelItem = ({ name, color, description, id, removeLabel, editLabel }) => {
    const handleRemove = useCallback((id, name) => {
        removeLabel(id, name);
    });

    const handleEdit = useCallback((id, name, color, description) => {
        editLabel(id, name, color, description);
    });

    return (
        <LabelRow>
            <LabelItemExampleContainer>
                <LabelItemExample color={color}>{name}</LabelItemExample>
            </LabelItemExampleContainer>
            <Description>{description}</Description>
            <IconFlex>
                <LabelIcon
                    to={{ state: { editLabel: true } }}
                    color="orange"
                    onClick={() => handleEdit(id, name, description, color)}
                    name="pencil-alt"
                    tip="Edit"
                />
                <LabelIcon
                    to={{ state: { removeLabel: true } }}
                    color="red"
                    onClick={() => handleRemove(id, name)}
                    name="fas fa-trash"
                    tip="Remove"
                />
            </IconFlex>
        </LabelRow>
    );
};
