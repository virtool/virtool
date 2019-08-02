import styled from "styled-components";

export const WallModalFooter = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 15px;

    & > span {
        color: ${props => props.theme.color.red};
        font-size: ${props => props.theme.fontSize.xs};
    }
`;
