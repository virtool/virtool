import styled from "styled-components";

export const DropDownContent = styled.div`
    display: ${props => (props.visible ? "flex" : "none")};

    position: absolute;
    flex-direction: column;
    text-decoration: none;
    background-color: white;
    box-shadow: 0 8px 16px 0px rgba(0, 0, 0, 0.2);
    top: 45px;
    right: 15px;
`;

export const DropDownMenu = styled.div`
    height: 100%;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: stretch;
    color: white;
    background-color: ${props => (props.visible ? "rgb(50, 112, 111)" : "none")};

    a {
        text-decoration: none;
        color: black;
    }

    & > a {
        align-items: center;
        display: flex;
        padding: 0 15px;
        color: white;
        text-decoration: none;

        :hover {
            color: #245251;
            text-decoration: none;
        }
    }

    &: focus {
        text-decoration: none;
        color: white;
    }
`;
