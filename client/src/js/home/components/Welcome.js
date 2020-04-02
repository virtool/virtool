import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Box, Container, ExternalLink, LoadingPlaceholder } from "../../base";
import { Support } from "./Support";
import { Upgrade } from "./Upgrade";

const StyledWelcome = styled(Container)`
    ${Box}:first-child {
        p {
            margin-bottom: 20px;
        }

        a {
            padding-right: 10px;
        }
    }
`;

export const Welcome = ({ mongoVersion, version }) => {
    if (!mongoVersion || !version) {
        return <LoadingPlaceholder />;
    }

    return (
        <StyledWelcome>
            <Box>
                <h3>
                    Virtool <small className="text-muted">{version}</small>
                </h3>
                <p>Viral infection diagnostics using next-generation sequencing</p>

                <strong>
                    <ExternalLink href="http://www.virtool.ca/">Website</ExternalLink>
                    <ExternalLink href="https://github.com/virtool/virtool">Github</ExternalLink>
                </strong>
            </Box>

            <Upgrade mongoVersion={mongoVersion} />
            <Support />
        </StyledWelcome>
    );
};

export const mapStateToProps = state => ({
    mongoVersion: get(state.updates, "mongo_version"),
    version: get(state.updates, "version")
});

export default connect(mapStateToProps, null)(Welcome);
