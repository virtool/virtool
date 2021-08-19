import React from "react";
import styled from "styled-components";
import { getFontSize } from "../../app/theme";
import { Box, Container, ExternalLink, NarrowContainer } from "../../base";
import { Support } from "./Support";

const StyledWelcome = styled(NarrowContainer)`
    ${Box}:first-child {
        h1 {
            font-size: ${getFontSize("xxl")};
            margin: 10px 0;
        }
        p {
            font-size: ${getFontSize("lg")};
            margin: 0 0 15px;
        }

        a {
            padding-right: 10px;
            font-size: ${getFontSize("md")};
        }
    }
`;

export const Welcome = () => (
    <Container>
        <StyledWelcome>
            <Box>
                <h1>Virtool {window.virtool.version}</h1>
                <p>Viral infection diagnostics using next-generation sequencing</p>

                <strong>
                    <ExternalLink href="http://www.virtool.ca/">Website</ExternalLink>
                    <ExternalLink href="https://github.com/virtool/virtool">Github</ExternalLink>
                </strong>
            </Box>

            <Support />
        </StyledWelcome>
    </Container>
);

export default Welcome;
