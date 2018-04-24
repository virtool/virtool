import React from "react";
import PropTypes from "prop-types";
// Migration path for older version of bootstrap pagination
import { Pagination as BSPagination } from "@react-bootstrap/pagination";

/**
 * A thin composition of the react-bootstrap Pagination component that simplifies the required props. Also centers the
 * Pagination component.
 *
 * @param documentCount {number} the number of documents that can be paged through
 * @param onPage {function} a callback to call with a new page number to page to
 * @param page {number} the current page number
 * @param pageCount {number} the total number of pages available
 */
export const Pagination = ({ documentCount, onPage, page, pageCount }) => (
    documentCount ? (
        <div className="text-center">
            <BSPagination
                items={pageCount}
                maxButtons={10}
                activePage={page}
                onSelect={onPage}
                first
                last
                next
                prev
            />
        </div>
    ) : null
);

Pagination.propTypes = {
    documentCount: PropTypes.number,
    onPage: PropTypes.func.isRequired,
    page: PropTypes.number,
    pageCount: PropTypes.number.isRequired
};
