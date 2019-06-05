import { sumBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";
import { Flex, FlexItem, RelativeTime } from "../../../base";
import { byteSize } from "../../../utils/utils";

const calculateSize = files => byteSize(sumBy(files, "size"));

export const SampleCacheItem = ({ created_at, files, hash, id, sampleId }) => (
    <LinkContainer to={`/samples/${sampleId}/files/${id}`}>
        <ListGroupItem>
            <Flex alignItems="flex-start" justifyContent="space-between">
                <FlexItem>
                    <Flex alignItems="center">
                        <i className="fas fa-archive fa-fw" style={{ fontSize: "24px" }} />
                        <FlexItem pad={10}>
                            <div>
                                <strong>{hash}</strong>
                            </div>
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
            </Flex>
        </ListGroupItem>
    </LinkContainer>
);

const mapStateToProps = state => ({
    sampleId: state.samples.detail.id
});

export default connect(mapStateToProps)(SampleCacheItem);
