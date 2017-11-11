/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";
import CX from "classnames";

export const PageHint = ({ page, count, totalCount, perPage = 15, pullRight = true}) => {
    const first = 1 + (page - 1) * perPage;
    const last = first + (count < perPage ? count - 1: perPage - 1);

    const classNames = CX("text-muted", {"pull-right": pullRight});

    return (
        <span className={classNames} style={{fontSize: "12px"}}>
            Viewing {first} - {last} of {totalCount}
        </span>
    );
};
