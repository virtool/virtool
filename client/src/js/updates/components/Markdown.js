import { replace } from "lodash-es";
import Marked from "marked";
import React from "react";
import styled from "styled-components";
import { getFontSize } from "../../app/theme";

const StyledReleaseMarkdown = styled.div`
    h4 {
        color: ${props => props.theme.color.greyDark};
        font-size: ${getFontSize("md")};
        font-weight: bold;
        padding-left: 10px;
    }
`;

export const ReleaseMarkdown = ({ body }) => {
    let html = Marked(body);

    html = replace(
        html,
        /#([0-9]+)/g,
        "<a target='_blank' href='https://github.com/virtool/virtool/issues/$1'>#$1</a>"
    );

    return (
        <StyledReleaseMarkdown>
            <div dangerouslySetInnerHTML={{ __html: html }} />
        </StyledReleaseMarkdown>
    );
};
