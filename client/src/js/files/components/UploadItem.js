import React from "react";
import { Flex, FlexItem, ListGroupItem, ProgressBar } from "../../base";
import { byteSize } from "../../utils/utils";

export const UploadItem = ({ name, progress, size }) => (
    <ListGroupItem>
        <ProgressBar bsStyle={progress === 100 ? "primary" : "success"} now={progress} affixed />
        <Flex>
            <FlexItem grow={1}>{name}</FlexItem>
            <FlexItem shrink={0} grow={0} pad={15}>
                {byteSize(size)}
            </FlexItem>
        </Flex>
    </ListGroupItem>
);
