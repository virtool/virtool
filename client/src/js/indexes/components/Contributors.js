import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../base";

const StyledContributor = styled(BoxGroupSection)`
    display: flex;
    justify-content: space-between;
`;

export const Contributor = ({ id, count }) => (
    <StyledContributor key={id}>
        {id}
        <Badge>
            {count} change{count === 1 ? "" : "s"}
        </Badge>
    </StyledContributor>
);

export const Contributors = ({ contributors }) => {
    const contributorComponents = map(contributors, contributor => (
        <Contributor key={contributor.id} {...contributor} />
    ));

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
