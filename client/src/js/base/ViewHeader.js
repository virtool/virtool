import React from "react";
import { Badge } from "react-bootstrap";
import { Flex, FlexItem, PageHint } from "./index";

export const ViewHeader = ({ title, page, foundCount, totalCount }) => (
    <h3 className="view-header">
        <Flex alignItems="flex-end">
            <FlexItem grow={0} shrink={0}>
                <strong>{title}</strong> <Badge>{totalCount}</Badge>
            </FlexItem>
            <FlexItem grow={1} shrink={0}>
                <PageHint
                    page={page}
                    count={foundCount}
                    totalCount={totalCount}
                />
            </FlexItem>
        </Flex>
    </h3>
);
