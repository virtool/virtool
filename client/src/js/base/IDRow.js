import React from "react";
import { connect } from "react-redux";

/**
 * An component for easily rendering unique ID table rows when the ``show_ids`` account setting is on. This component
 * would be used for example in a table on a sample detail page to show the database id of the sample.
 *
 * @param id
 * @param showIds
 */
export const IDRowComponent = ({ id, showIds }) =>
    showIds ? (
        <tr>
            <th>Unique ID</th>
            <td>{id}</td>
        </tr>
    ) : null;

const mapStateToProps = state => ({
    showIds: state.account.settings.show_ids
});

export const IDRow = connect(mapStateToProps)(IDRowComponent);
