import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { BoxGroup, InputError, NoneFoundSection } from "../../base";
import { ReferenceSelectorItem } from "./ReferenceSelectorItem";

const ReferenceSelectList = styled(BoxGroup)`
    border-color: ${props => (props.error ? props.theme.color.red : props.theme.color.grey)};
    border-radius: ${props => props.theme.borderRadius.sm};
    margin-bottom: 3px;
    max-height: 200px;
    overflow-y: auto;
`;

const StyledReferenceSelect = styled.div`
    margin-bottom: 20px;
`;

export const ReferenceSelector = ({ references, error, selected, onSelect }) => {
    let referenceComponents = map(references, reference => (
        <ReferenceSelectorItem
            reference={reference}
            key={reference.id}
            onClick={() => onSelect(reference.id)}
            active={selected === reference.id}
        />
    ));

    if (!referenceComponents.length) {
        referenceComponents = <NoneFoundSection noun="source references" />;
    }

    return (
        <StyledReferenceSelect>
            <label>Source Reference</label>
            <ReferenceSelectList error={error}>{referenceComponents}</ReferenceSelectList>
            <InputError>{error}</InputError>
        </StyledReferenceSelect>
    );
};
