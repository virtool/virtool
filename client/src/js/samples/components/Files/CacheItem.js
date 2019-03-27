import React from "react";
import { ListGroupItem } from "react-bootstrap";
import { Flex, FlexItem } from "../../../base";

const SampleCacheItem = ({ hash, id }) => (
    <ListGroupItem>
        <Flex alignItems="flex-start" justifyContent="space-between">
            <FlexItem>
                <Flex alignItems="center">
                    <i className="fas fa-archive fa-fw" style={{ fontSize: "24px" }} />
                    <FlexItem pad={10}>
                        <div>
                            <strong className="text-uppercase">{id}</strong>
                        </div>
                        <div>
                            <small>Created from SOMETHING</small>
                        </div>
                    </FlexItem>
                </Flex>
            </FlexItem>
            <FlexItem>
                <div className="text-right">
                    <div>
                        <strong>SIZE</strong>
                    </div>
                </div>
            </FlexItem>
        </Flex>
    </ListGroupItem>
);

export default SampleCacheItem;
