import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Box } from "../../../base";
import { Bars } from "../Viewer/Bars";
import { Histogram } from "./Histogram";

const StyledAODPOverview = styled(Box)`
    h3 {
        font-size: ${props => props.theme.fontSize.md};
        font-weight: bold;
        margin: 20px 0 10px;

        :first-child {
            margin-top: 5px;
        }
    }
`;

export const AODPOverview = ({ joined, histogram, remainder }) => (
    <StyledAODPOverview>
        <h3>Read Joining</h3>
        <Bars
            items={[
                { color: "green", count: joined, title: "Joined" },
                { color: "orange", count: remainder, title: "Not Joined" }
            ]}
        />

        <h3>Joined Length Distribution</h3>
        <Histogram data={histogram} />
    </StyledAODPOverview>
);

const mapStateToProps = state => {
    const { joined_pair_count, join_histogram, remainder_pair_count } = state.analyses.detail;
    return {
        joined: joined_pair_count,
        histogram: join_histogram,
        remainder: remainder_pair_count
    };
};

export default connect(mapStateToProps)(AODPOverview);
