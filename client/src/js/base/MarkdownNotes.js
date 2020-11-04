import React from "react";
import styled from "styled-components";
import Marked from "marked";
import { Box } from "./Box";

const NotesBox = styled(Box)`
    overflow-y: scroll;
    max-height: 375px;
    margin-bottom: 0px;
`;

export const MarkdownNotes = ({ notes }) => {
    let markedNotes = Marked(notes ? notes : "Edit the sample to add additional notes.");
    return (
        <NotesBox>
            <div dangerouslySetInnerHTML={{ __html: markedNotes }} />
        </NotesBox>
    );
};
