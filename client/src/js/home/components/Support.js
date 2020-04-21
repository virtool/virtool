import React from "react";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, ExternalLink, Icon } from "../../base";

const SupportHeader = styled(BoxGroupHeader)`
    i {
        margin-right: 5px;
    }
`;

const SupportBody = styled(BoxGroupSection)`
    h5 {
        :not(:first-child) {
            margin-top: 20px;
        }
    }
`;

export const Support = () => (
    <BoxGroup>
        <SupportHeader>
            <h2>
                <Icon name="question-circle" />
                Support
            </h2>
        </SupportHeader>
        <SupportBody>
            <h5>Email</h5>
            <span>Please do not email the developers or other members of the lab for support.</span>
            <h5>GitHub Issues</h5>
            <ExternalLink href="https://github.com/virtool/virtool/issues">Open an issue on GitHub</ExternalLink>
            <span> for:</span>
            <ul>
                <li>General questions</li>
                <li>Bug reports</li>
                <li>Feature requests</li>
            </ul>
            <span>Before opening an issue, check that there is not an existing issue addressing your problem.</span>
            <h5>Gitter</h5>
            <span>Chat on </span>
            <ExternalLink href="https://gitter.im/virtool/virtool">Gitter</ExternalLink>
            <span> to get support from the developers and other users.</span>
        </SupportBody>
    </BoxGroup>
);
