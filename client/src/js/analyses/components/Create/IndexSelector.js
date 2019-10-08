import { map, some } from "lodash-es";
import React, { useCallback } from "react";
import { Label, ListGroup } from "react-bootstrap";
import styled from "styled-components";
import { Checkbox, ListGroupItem, NoneFound } from "../../../base";

const StyledIndexSelectItem = styled(ListGroupItem)`
    align-items: center;
    display: flex;
    justify-content: space-between;

    .label {
        margin-left: 3px;
    }

    span {
        align-items: center;
        display: flex;
    }

    strong {
        margin-left: 8px;
    }
`;

export const IndexSelectItem = ({ id, reference, isSelected, version, onSelect }) => {
    const handleClick = useCallback(() => onSelect({ id, refId: reference.id }), []);
    return (
        <StyledIndexSelectItem onClick={handleClick}>
            <span>
                <Checkbox checked={isSelected} />
                <strong>{reference.name}</strong>
            </span>
            <span>
                Index Version <Label>{version}</Label>
            </span>
        </StyledIndexSelectItem>
    );
};

const StyledIndexSelectList = styled(ListGroup)`
    border: 1px solid ${props => (props.error.length ? "#d44b40" : "transparent")};
    max-height: 165px;
    overflow-y: auto;
    margin-bottom: 3px;
`;

const IndexSelectList = ({ error, indexes, selected, onSelect }) => {
    const indexComponents = map(indexes, index => {
        const isSelected = some(selected, { id: index.id });
        return <IndexSelectItem key={index.id} {...index} isSelected={isSelected} onSelect={onSelect} />;
    });

    return <StyledIndexSelectList error={error}>{indexComponents}</StyledIndexSelectList>;
};

export const IndexSelector = ({ indexes, onSelect, selected, error }) => {
    return (
        <div style={{ marginBottom: "16px" }}>
            <label className="control-label">References</label>
            {indexes.length ? (
                <IndexSelectList error={error} indexes={indexes} selected={selected} onSelect={onSelect} />
            ) : (
                <NoneFound noun="source references" />
            )}
        </div>
    );
};
