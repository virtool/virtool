import { map, sortBy } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { LoadingPlaceholder, BoxGroupSection, BoxGroupHeader, BoxGroup } from "../../base";

const HistoryItem = styled(BoxGroupSection)`
    display: grid;
    grid-template-columns: 1fr 1fr;
`;

const RebuildHistoryContent = styled.div`
    max-height: 700px;
    overflow-y: auto;
`;

const StyledRebuildHistoryEllipsis = styled(BoxGroupSection)`
    text-align: right;
`;

export const RebuildHistoryEllipsis = ({ unbuilt }) => {
    if (unbuilt.page_count > 1) {
        return (
            <StyledRebuildHistoryEllipsis key="last-item">
                + {unbuilt.total_count - unbuilt.per_page} more changes
            </StyledRebuildHistoryEllipsis>
        );
    }

    return null;
};

export const RebuildHistoryItem = ({ description, otuName }) => (
    <HistoryItem>
        <strong>{otuName}</strong>

        {description || "No Description"}
    </HistoryItem>
);

export default function RebuildHistory({ unbuilt }) {
    let content;

    if (unbuilt === null) {
        content = <LoadingPlaceholder margin="22px" />;
    } else {
        const historyComponents = map(sortBy(unbuilt.documents, "otu.name"), change => (
            <RebuildHistoryItem key={change.id} description={change.description} otuName={change.otu.name} />
        ));

        content = (
            <RebuildHistoryContent>
                {historyComponents}
                <RebuildHistoryEllipsis unbuilt={unbuilt} />
            </RebuildHistoryContent>
        );
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>Changes</BoxGroupHeader>
            {content}
        </BoxGroup>
    );
}
