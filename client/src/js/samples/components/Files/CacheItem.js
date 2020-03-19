import { sumBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Badge, BoxGroupSection, Flex, FlexItem, Icon, RelativeTime } from "../../../base";
import { byteSize } from "../../../utils/utils";

const calculateSize = files => byteSize(sumBy(files, "size"));

const CacheItemLink = styled(Link)`
    display: block;
    font-weight: bold;
`;

const CacheItemRight = styled.div`
    display: flex;
    font-weight: bold;
    width: 180px;
    justify-content: space-between;
`;

const StyledSampleCacheItem = styled(BoxGroupSection)`
    align-items: flex-start;
    display: flex;
    justify-content: space-between;
`;

export const SampleCacheItem = ({ createdAt, files, hash, id, missing, sampleId }) => {
    let missingBadge;

    if (missing) {
        missingBadge = (
            <Badge color="red">
                <Icon name="exclamation-circle" /> Files Missing
            </Badge>
        );
    }

    return (
        <StyledSampleCacheItem>
            <Flex alignItems="center">
                <i className="fas fa-archive fa-fw" style={{ fontSize: "24px" }} />
                <FlexItem pad={10}>
                    <CacheItemLink to={`/samples/${sampleId}/files/${id}`}>{hash}</CacheItemLink>
                    <small>
                        Created <RelativeTime time={createdAt} />
                    </small>
                </FlexItem>
            </Flex>
            <CacheItemRight>
                <div>{missingBadge}</div>
                <div>{calculateSize(files)}</div>
            </CacheItemRight>
        </StyledSampleCacheItem>
    );
};

export const mapStateToProps = state => ({
    sampleId: state.samples.detail.id
});

export default connect(mapStateToProps)(SampleCacheItem);
