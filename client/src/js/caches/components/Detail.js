import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    LoadingPlaceholder,
    RelativeTime,
    SubviewHeader,
    SubviewHeaderAttribution,
    SubviewHeaderTitle
} from "../../base";
import { getCache } from "../actions";
import CacheQuality from "./Quality";
import CacheGeneral from "./General";
import CacheParameters from "./Parameters";

const StyledCacheDetail = styled.div`
    overflow-x: hidden;
`;

export const CacheDetail = ({ detail, match, sampleName, onGet }) => {
    useEffect(() => onGet(match.params.cacheId), [match.params.cacheId]);

    if (detail === null) {
        return <LoadingPlaceholder />;
    }

    return (
        <StyledCacheDetail>
            <SubviewHeader>
                <SubviewHeaderTitle>Cache for {sampleName}</SubviewHeaderTitle>
                <SubviewHeaderAttribution>
                    Created <RelativeTime time={detail.created_at} />
                </SubviewHeaderAttribution>
            </SubviewHeader>
            <CacheGeneral {...detail} />
            <CacheParameters parameters={detail.parameters} />
            <CacheQuality />
        </StyledCacheDetail>
    );
};

export const mapStateToProps = state => {
    return {
        detail: state.caches.detail,
        sampleName: state.samples.detail.name
    };
};

export const mapDispatchToProps = dispatch => {
    return {
        onGet: cacheId => {
            dispatch(getCache(cacheId));
        }
    };
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CacheDetail);
