import React from "react";
import styled from "styled-components";
import { BoxGroupSection, LinkIcon } from "../../base";
import { SampleLabel } from "../../samples/components/Label";

const LabelItemContainer = styled.div`
    position: relative;
`;

const LabelItemBox = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
`;

const LabelItemExampleContainer = styled.div`
    min-width: 30%;
`;

const LabelItemIcons = styled.div`
    align-items: center;
    background-color: transparent;
    display: flex;
    font-size: 17px;
    padding-right: 15px;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 20;

    *:not(:first-child) {
        margin-left: 5px;
    }
`;

export const Item = ({ name, color, description, id }) => (
    <LabelItemContainer>
        <LabelItemBox>
            <LabelItemExampleContainer>
                <SampleLabel name={name} color={color} />
            </LabelItemExampleContainer>
            {description}
        </LabelItemBox>
        <LabelItemIcons>
            <LinkIcon to={{ state: { editLabel: id } }} color="orange" name="pencil-alt" tip="Edit" />
            <LinkIcon to={{ state: { removeLabel: id } }} color="red" name="fas fa-trash" tip="Remove" />
        </LabelItemIcons>
    </LabelItemContainer>
);
