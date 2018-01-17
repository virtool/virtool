import React from "react";
import CX from "classnames";
import { Badge } from "react-bootstrap";
import { Flex, FlexItem } from "./index";

/**
 * A textual component that shows the current position in pagination (eg. Viewing 1 - 15 of 1419).
 *
 * @func
 * @param page {number} the current page
 * @param count {number} the number of items shown
 * @param totalCount {number} the total number of items that can be paged through
 * @param perPage {number} the number of items shown per page
 * @param pullRight {boolean} pull the element to the right
 */
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

/**
 * A reusable header shown at the top of views that browse through paged items. For example, the viruses browser
 * contains a ``<ViewHeader />`` component with the title 'Viruses', a badge showing the total virus count and a
 * <PageHint /> sub-component showing the position in pagination.
 *
 * @func
 * @param title {string} the main title for the headed view
 * @param page {number} the current page in pagination
 * @param count {count} the number of items currently shown
 * @param foundCount {count} the number of documents found by the current query
 * @param totalCount {count} the total number of documents
 */
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
