import { map } from "lodash-es";
import React from "react";
import { ListGroup } from "react-bootstrap";
import styled from "styled-components";
import { NoneFound } from "../../base";
import { ReferenceSelectItem } from "./ReferenceSelectItem";

const ReferenceSelectList = styled(({ ...rest }) => <ListGroup {...rest} />)`
    max-height: 85px;
    overflow-y: auto;
    margin-bottom: 3px;
    border: ${props => (props.hasError ? "1px solid #d44b40" : "1px solid transparent")};
`;

export const ReferenceSelect = ({ references, hasError, selected, onSelect }) => {
    return (
        <div>
            <label className="control-label">Source Reference</label>
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
                <NoneFound noun="source references" />
            )}
        </div>
    );
};
