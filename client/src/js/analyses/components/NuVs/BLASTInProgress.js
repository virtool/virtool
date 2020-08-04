import React from "react";
import { formatDistanceStrict, addSeconds } from "date-fns";
import styled from "styled-components";
import { Box, ExternalLink, Icon, Loader, RelativeTime } from "../../../base";

const ridRoot =
    "https://blast.ncbi.nlm.nih.gov/Blast.cgi?\
    CMD=Web&PAGE_TYPE=BlastFormatting&OLD_BLAST=false&GET_RID_INFO=on&RID=";

export const RIDLink = ({ rid }) => {
    if (rid) {
        return (
            <span>
                <span> with RID </span>
                <ExternalLink href={ridRoot + rid}>
                    {rid}{" "}
                    <sup>
                        <Icon name="new-tab" />
                    </sup>
                </ExternalLink>
            </span>
        );
    }

    return null;
};

const StyledRIDTiming = styled.div`
    font-size: ${props => props.theme.fontSize.sm};
    margin-left: auto;
`;

export const RIDTiming = ({ interval, lastCheckedAt }) => {
    if (lastCheckedAt) {
        const nextCheckAt = addSeconds(new Date(lastCheckedAt), interval);
        const relativeNext = formatDistanceStrict(new Date(nextCheckAt), Date.now());

        return (
            <StyledRIDTiming>
                Last checked <RelativeTime time={lastCheckedAt} />. Checking again in {relativeNext}
            </StyledRIDTiming>
        );
    }

    return null;
};

const StyledBLASTInProgress = styled(Box)`
    align-items: flex-start;
    display: flex;

    div:first-of-type {
        margin-right: 5px;
    }
`;

export const BLASTInProgress = ({ interval, lastCheckedAt, rid }) => {
    return (
        <StyledBLASTInProgress>
            <Loader size="16px" color="primary" />
            <div>
                <div>
                    <span>BLAST in progress</span>
                    <RIDLink rid={rid} />
                </div>
                <RIDTiming interval={interval} lastCheckedAt={lastCheckedAt} />
            </div>
        </StyledBLASTInProgress>
    );
};
