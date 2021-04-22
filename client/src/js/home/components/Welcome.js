import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize } from "../../app/theme";
import { Box, Container, ExternalLink, LoadingPlaceholder, NarrowContainer } from "../../base";
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

export const Welcome = ({ mongoVersion, version }) => {
    if (!mongoVersion || !version) {
        return <LoadingPlaceholder />;
    }

    return (
        <Container>
            <StyledWelcome>
                <Box>
                    <h1>Virtool {version}</h1>
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
};

export const mapStateToProps = state => ({
    mongoVersion: get(state.updates, "mongo_version"),
    version: get(state.updates, "version")
});

export default connect(mapStateToProps, null)(Welcome);
