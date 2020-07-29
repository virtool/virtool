import React, { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { getBorder } from "../../../app/theme";
import { Icon } from "../../../base";
import PathoscopeList from "./List";
import Mapping from "./Mapping";
import PathoscopeToolbar from "./Toolbar";

const StyledPathoscopeViewerScroller = styled.div`
    align-items: center;
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.lg};
    bottom: 30px;
    color: ${props => props.theme.color.greyDark};
    cursor: pointer;
    display: flex;
    height: 40px;
    justify-content: center;
    left: 30px;
    position: fixed;
    width: 40px;

    :hover {
        background-color: ${props => props.theme.color.greyLightest};
        color: ${props => props.theme.color.greyDarkest};
    }
`;

const PathoscopeViewerScroller = () => {
    const [show, setShow] = useState(false);

    const handleClick = useCallback(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    const handleScroll = useCallback(() => {
        setShow(window.scrollY > 0);
    }, []);

    useEffect(() => {
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (show) {
        return (
            <StyledPathoscopeViewerScroller onClick={handleClick}>
                <Icon name="arrow-up" />
            </StyledPathoscopeViewerScroller>
        );
    }

    return null;
};

export const PathoscopeViewer = () => (
    <div>
        <Mapping />
        <PathoscopeToolbar />
        <PathoscopeList />
        <PathoscopeViewerScroller />
    </div>
);

export default PathoscopeViewer;
