import React from "react";
import { satisfies } from "semver";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, ExternalLink, Icon } from "../../base";

const UpgradeHeader = styled(BoxGroupHeader)`
    i {
        margin-right: 5px;
    }
`;

const UpgradeBody = styled(BoxGroupSection)`
    padding-top: 15px;

    li:not(:last-child) {
        margin-bottom: 3px;
    }
`;

export const Upgrade = ({ mongoVersion }) => {
    let verdict;

    if (satisfies(mongoVersion, ">=3.6.0")) {
        verdict = (
            <strong className="text-success">
                Virtool detected MongoDB {mongoVersion} and no upgrade is required for this instance.
            </strong>
        );
    } else {
        verdict = (
            <strong className="text-danger">
                Virtool detected MongoDB {mongoVersion} and a database upgrade will be required to support Virtool
                4.0.0.
            </strong>
        );
    }

    return (
        <BoxGroup>
            <UpgradeHeader>
                <h2>
                    <Icon name="exclamation-circle" /> Important Upgrade Information
                </h2>
            </UpgradeHeader>
            <UpgradeBody>
                <p>A major upgrade to Virtool 4.0.0 will be available soon. As part of this upgrade: </p>
                <ul>
                    <li>
                        Versions of MongoDB older than <strong>3.6</strong> will no longer be supported
                    </li>
                    <li>MongoDB 4.0 and newer will be supported</li>
                </ul>
                <p>
                    <span>We provide a guide for </span>
                    <ExternalLink href="https://www.virtool.ca/docs/manual/gs_mongo/#upgrade-mongodb">
                        upgrading to a newer version of MongoDB
                    </ExternalLink>
                    <span> and are available for support.</span>
                </p>
                <p>{verdict}</p>
            </UpgradeBody>
        </BoxGroup>
    );
};
