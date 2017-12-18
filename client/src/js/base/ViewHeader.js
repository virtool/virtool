import React from "react";
import CX from "classnames";
import { Badge } from "react-bootstrap";
import { Flex, FlexItem } from "./index";

const PageHint = ({ page, count, totalCount, perPage = 15, pullRight = true}) => {
    const first = 1 + (page - 1) * perPage;

    const last = first + (count < perPage ? count - 1 : perPage - 1);

    const classNames = CX("text-muted", {"pull-right": pullRight});

    return (
        <span className={classNames} style={{fontSize: "12px"}}>
            Viewing {totalCount === 0 ? 0 : first} - {last} of {totalCount}
        </span>
    );
};

export const ViewHeader = ({ title, page, count, foundCount, totalCount }) => (
    <h3 className="view-header">
        <Flex alignItems="flex-end">
            <FlexItem grow={0} shrink={0}>
                <strong>{title}</strong> <Badge>{totalCount}</Badge>
            </FlexItem>
            <FlexItem grow={1} shrink={0}>
                <PageHint
                    page={page}
                    count={count}
                    totalCount={foundCount}
                />
            </FlexItem>
        </Flex>
    </h3>
);
