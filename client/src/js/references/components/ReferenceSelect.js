import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { BoxGroup, NoneFoundBox } from "../../base";
import { ReferenceSelectItem } from "./ReferenceSelectItem";

const ReferenceSelectList = styled(BoxGroup)`
    border: 1px solid ${props => (props.hasError ? "#d44b40" : "#ddd")};
    margin-bottom: 3px;
    max-height: 200px;
    overflow-y: auto;
`;

export const ReferenceSelect = ({ references, hasError, selected, onSelect }) => {
    return (
        <div>
            <label>Source Reference</label>
            {references.length ? (
                <ReferenceSelectList hasError={hasError}>
                    {map(references, reference => (
                        <ReferenceSelectItem
                            reference={reference}
                            key={reference.id}
                            onClick={() => onSelect(reference.id)}
                            active={selected === reference.id}
                        />
                    ))}
                </ReferenceSelectList>
            ) : (
                <NoneFoundBox noun="source references" />
            )}
        </div>
    );
};
