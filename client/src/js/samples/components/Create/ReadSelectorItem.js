import PropTypes from "prop-types";
import React, { useCallback } from "react";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../../app/theme";
import { Icon, SelectBoxGroupSection } from "../../../base";
import { byteSize } from "../../../utils/utils";

const ReadIcon = styled.span`
    font-size: 24px;
    margin-right: 15px;
`;

const ReadTitle = styled.div`
    align-items: center;
    display: flex;

    strong {
        font-weight: ${getFontWeight("thick")};
    }
`;

const StyledReadOrientation = styled.div`
    background-color: ${props => props.theme.color.blueDark};
    border: 2px solid ${props => props.theme.color.white};
    border-radius: ${props => props.theme.borderRadius.md};
    color: ${props => props.theme.color.white};
    font-size: ${getFontSize("sm")};
    font-weight: ${getFontWeight("bold")};
    text-align: center;
    width: 48px;
`;

export const ReadOrientation = ({ index, selected }) => {
    if (selected) {
        return <StyledReadOrientation>{index === 0 ? "LEFT" : "RIGHT"}</StyledReadOrientation>;
    }

    return null;
};

const StyledReadSelectorItem = styled(SelectBoxGroupSection)`
    align-items: center;
    display: flex;
    justify-content: space-between;
    user-select: none;
`;

export const ReadSelectorItem = ({ id, index, name, selected, size, onSelect }) => {
    const select = useCallback(() => onSelect(id), []);

    return (
        <StyledReadSelectorItem onClick={select} active={selected}>
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
        </StyledReadSelectorItem>
    );
};

ReadSelectorItem.defaultProps = {
    selected: false
};

ReadSelectorItem.propTypes = {
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired,
    size: PropTypes.number.isRequired,
    onSelect: PropTypes.func.isRequired,
    selected: PropTypes.bool
};

export default ReadSelectorItem;
