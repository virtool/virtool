import styled from "styled-components";

export const Box = styled.div`
    border: 1px #dddddd solid;
    border-radius: 2px;
    box-sizing: border-box;
    margin-bottom: 10px;
    padding: 10px 15px;
    cursor: ${props => (props.onClick ? "pointer" : "auto")};
`;

export const BoxTitle = styled.h1`
    font-size: 14px;
    font-weight: bold;
    margin: 5px 0 15px 0;
`;

export const SpacedBox = styled(Box)`
    box-shadow: 1px 1px 2px 0 #d5d5d5;
    margin-bottom: 10px;
`;
