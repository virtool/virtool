import React from "react";
import styled from "styled-components";
import { sumBy } from "lodash-es";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { BoxGroupSection, Flex, FlexItem, RelativeTime } from "../../../base";
import { byteSize } from "../../../utils/utils";

const calculateSize = files => byteSize(sumBy(files, "size"));

const CacheItemLink = styled(Link)`
    display: block;
    font-weight: bold;
`;

const StyledSampleCacheItem = styled(BoxGroupSection)`
    align-items: flex-start;
    display: flex;
    justify-content: space-between;
`;

export const SampleCacheItem = ({ created_at, files, hash, id, sampleId }) => (
    <StyledSampleCacheItem>
        <FlexItem>
            <Flex alignItems="center">
                <i className="fas fa-archive fa-fw" style={{ fontSize: "24px" }} />
                <FlexItem pad={10}>
                    <CacheItemLink to={`/samples/${sampleId}/files/${id}`}>
                        <strong>{hash}</strong>
                    </CacheItemLink>
                    <div>
                        <small>
                            Created <RelativeTime time={created_at} />
                        </small>
                    </div>
                </FlexItem>
            </Flex>
        </FlexItem>
        <FlexItem>
            <div className="text-right">
                <div>
                    <strong>{calculateSize(files)}</strong>
                </div>
            </div>
        </FlexItem>
    </StyledSampleCacheItem>
);

const mapStateToProps = state => ({
    sampleId: state.samples.detail.id
});

export default connect(mapStateToProps)(SampleCacheItem);
