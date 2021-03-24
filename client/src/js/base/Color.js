import React, { useCallback } from "react";
import styled from "styled-components";
import { borderRadius } from "../app/theme";
import { Box } from "./Box";
import { Input } from "./Input";

const colors = [
    // Grey
    "D1D5DB",
    "6B7280",
    "374151",

    // Red
    "FCA5A5",
    "EF4444",
    "B91C1C",

    // Yellow
    "FCD34D",
    "F59E0B",
    "B45309",

    // Green
    "6EE7B7",
    "10B981",
    "047857",

    // Blue
    "93C5FD",
    "3B82F6",
    "1D4ED8",

    // Indigo
    "A5B4FC",
    "6366F1",
    "4338CA",

    // Purple
    "C4B5FD",
    "8B5CF6",
    "5B21B6",

    // Pink
    "FBCFE8",
    "F472B6",
    "EC4899"
];

const StyledColor = styled(Box)`
    padding: 10px;
`;

const UnstyledColorSquare = ({ className, color, onClick }) => {
    const handleClick = useCallback(() => onClick(color), [color, onClick]);
    return <button className={className} type="button" title={color} onClick={handleClick} />;
};

const ColorSquare = styled(UnstyledColorSquare)`
    backface-visibility: hidden;
    background-color: ${props => props.color};
    background-image: none;
    border: none;
    cursor: pointer;
    flex: 1 0 auto;
    width: auto;

    &:first-child {
        border-bottom-left-radius: ${borderRadius.sm};
        border-top-left-radius: ${borderRadius.sm};
    }

    &:last-child {
        border-bottom-right-radius: ${borderRadius.sm};
        border-top-right-radius: ${borderRadius.sm};
    }

    &:focus {
        box-shadow: rgb(0 0 0 / 25%) 0 0 5px 2px;
        outline: solid white 2px;
        z-index: 2;
    }

    &:hover {
        transform: translateY(-2px);
    }
`;

const ColorGrid = styled.div`
    align-items: stretch;
    background-color: transparent;
    display: flex;
    height: 30px;
    margin-top: 10px;
`;

export const Color = ({ id, value, onChange }) => {
    const squares = colors.map(color => <ColorSquare key={color} color={`#${color}`} onClick={onChange} />);

    return (
        <StyledColor>
            <Input id={id} value={value} onChange={e => onChange(e.target.value)} />
            <ColorGrid>{squares}</ColorGrid>
        </StyledColor>
    );
};
