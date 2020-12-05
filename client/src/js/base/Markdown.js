import Marked from "marked";
import React from "react";
import styled from "styled-components";
import { NoneFound } from "./NoneFound";

const StyledMarkdown = styled.div`
    overflow-y: scroll;
    max-height: 375px;
    margin-bottom: 0px;
    padding: 10px 15px;
`;

export const Markdown = ({ markdown }) => {
    if (markdown) {
        return <StyledMarkdown dangerouslySetInnerHTML={{ __html: Marked(markdown) }} />;
    }

    return (
        <StyledMarkdown>
            <NoneFound noun="notes" />
        </StyledMarkdown>
    );
};
