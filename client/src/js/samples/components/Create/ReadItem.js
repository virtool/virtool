import React, { useCallback } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

import { byteSize } from "../../../utils/utils";
import { Icon, ListGroupItem } from "../../../base";

const ReadIcon = styled.span`
    font-size: 24px;
    margin-right: 15px;
`;

const ReadTitle = styled.div`
    align-items: center;
    display: flex;
`;

const StyledReadItem = styled(ListGroupItem)`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

const StyledReadOrientation = styled.div`
    background-color: #07689d;
    border: 2px solid #ffffff;
    border-radius: 4px;
    color: #ffffff;
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    width: 48px;
`;

export const ReadOrientation = ({ index, selected }) => {
    if (selected) {
        return <StyledReadOrientation>{index === 0 ? "LEFT" : "RIGHT"}</StyledReadOrientation>;
    }

    return null;
};

export const ReadItem = ({ id, index, name, selected, size, onSelect }) => {
    const select = useCallback(() => onSelect(id), []);

    return (
        <StyledReadItem onClick={select} active={selected}>
            <ReadTitle>
                <ReadIcon>
                    <Icon name="file" />
                </ReadIcon>
                <div>
                    <strong>{name}</strong>
                    <div>{byteSize(size)}</div>
                </div>
            </ReadTitle>
            <ReadOrientation index={index} selected={selected} />
        </StyledReadItem>
    );
};

ReadItem.defaultProps = {
    selected: false
};

ReadItem.propTypes = {
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
    size: PropTypes.number.isRequired,
    onSelect: PropTypes.func.isRequired,
    selected: PropTypes.bool
};

export default ReadItem;
