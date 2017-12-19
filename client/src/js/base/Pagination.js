import React from "react";
import { Pagination as BSPagination } from "react-bootstrap";

export const Pagination = ({ documentCount, onPage, page, pageCount }) => {
    if (documentCount) {
        return (
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
        );
    }

    return null;
};
