import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { FixedSizeList } from "react-window";
import { getMatches, getResults } from "../../selectors";
import NuVsItem from "./Item";

const NuVsListHeader = styled.div`
    background-color: #f5f5f5;
    border: 1px solid ${props => props.theme.color.greyLight};
    border-bottom: none;
    box-shadow: 0 5px 5px -3px #d5d5d5;
    padding: 7px 15px;
    z-index: 1000;
`;

const StyledNuVsList = styled(FixedSizeList)`
    flex: 0 0 auto;
`;

export const NuVsList = ({ shown, total }) => {
    return (
        <div>
            <NuVsListHeader>
                Showing {shown} of {total}
            </NuVsListHeader>
            <StyledNuVsList height={500} width={200} itemCount={shown} itemSize={58}>
                {NuVsItem}
            </StyledNuVsList>
        </div>
    );
};

const mapStateToProps = state => ({
    shown: getMatches(state).length,
    total: getResults(state).length
});

export default connect(mapStateToProps)(NuVsList);
