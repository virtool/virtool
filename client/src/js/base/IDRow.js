import React from "react";
import { connect } from "react-redux";

const IDRowComponent = ({ id, showIds }) => {
    if (showIds) {
        return (
            <tr>
                <th>Unique ID</th>
                <td>{id}</td>
            </tr>
        );
    }

    return null;
};

const mapStateToProps = (state) => ({
    showIds: state.account.settings.show_ids
});

export const IDRow = connect(mapStateToProps)(IDRowComponent);
