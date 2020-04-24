import React from "react";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, BoxTitle, ExternalLink, Icon } from "../../base";

export const Support = () => (
    <BoxGroup>
        <BoxGroupHeader>
            <h2>
                <span>
                    <Icon name="question-circle" /> Support
                </span>
            </h2>
        </BoxGroupHeader>
        <BoxGroupSection>
            <BoxTitle>Email</BoxTitle>
            <span>Please do not email the developers or other members of the lab for support.</span>
        </BoxGroupSection>
        <BoxGroupSection>
            <BoxTitle>GitHub Issues</BoxTitle>
            <ExternalLink href="https://github.com/virtool/virtool/issues">Open an issue on GitHub</ExternalLink>
            <span> for:</span>
            <ul>
                <li>General questions</li>
                <li>Bug reports</li>
                <li>Feature requests</li>
            </ul>
            <span>Before opening an issue, check that there is not an existing issue addressing your problem.</span>
        </BoxGroupSection>
        <BoxGroupSection>
            <BoxTitle>Gitter</BoxTitle>
            <span>Chat on </span>
            <ExternalLink href="https://gitter.im/virtool/virtool">Gitter</ExternalLink>
            <span> to get support from the developers and other users.</span>
        </BoxGroupSection>
    </BoxGroup>
);
