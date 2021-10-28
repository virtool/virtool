import { map, sortBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, BoxGroup, BoxGroupHeader, BoxGroupSection, InitialIcon, NoneFoundSection } from "../../base";

const StyledContributor = styled(BoxGroupSection)`
    display: flex;
    align-items: center;
    .InitialIcon {
        margin-right: 5px;
    }
    ${Badge} {
        margin-left: auto;
    }
`;

export const Contributor = ({ id, count }) => (
    <StyledContributor key={id}>
        <InitialIcon handle={id} size="md" />
        {id}
        <Badge>
            {count} change{count === 1 ? "" : "s"}
        </Badge>
    </StyledContributor>
);

export const Contributors = ({ contributors }) => {
    const sorted = sortBy(contributors, ["id", "count"]);

    let contributorComponents = map(sorted, contributor => <Contributor key={contributor.id} {...contributor} />);

    if (contributorComponents.length === 0) {
        contributorComponents = <NoneFoundSection noun="contributors" />;
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>
                    Contributors <Badge>{contributors.length}</Badge>
                </h2>
            </BoxGroupHeader>
            {contributorComponents}
        </BoxGroup>
    );
};

export const mapStateToProps = state => ({
    contributors: state.indexes.detail.contributors
});

export default connect(mapStateToProps)(Contributors);
