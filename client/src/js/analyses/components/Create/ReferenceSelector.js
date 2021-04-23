import { map } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import styled from "styled-components";
import { Label } from "../../../base";
import { MultiSelector, MultiSelectorItem } from "../../../base/MultiSelector";

const StyledReferenceSelectorItem = styled(MultiSelectorItem)`
    > span:last-child {
        margin-left: auto;
    }
`;

export const ReferenceSelectorItem = ({ id, name, version }) => (
    <StyledReferenceSelectorItem value={id}>
        <strong>{name}</strong>
        <span>
            Index Version <Label>{version}</Label>
        </span>
    </StyledReferenceSelectorItem>
);

export const ReferenceSelector = ({ hasError, indexes, selected, onChange }) => {
    const referenceComponents = map(indexes, index => (
        <ReferenceSelectorItem
            key={index.reference.id}
            id={index.reference.id}
            name={index.reference.name}
            version={index.version}
        />
    ));

    return (
        <React.Fragment>
            <label>References</label>
            <MultiSelector
                error={hasError && "Reference(s) must be selected"}
                noun="references"
                selected={selected}
                onChange={onChange}
            >
                {referenceComponents}
            </MultiSelector>
        </React.Fragment>
    );
};

ReferenceSelector.propTypes = {
    hasError: PropTypes.bool,
    indexes: PropTypes.arrayOf(PropTypes.object).isRequired,
    selected: PropTypes.arrayOf(PropTypes.string).isRequired,
    onChange: PropTypes.func.isRequired
};
