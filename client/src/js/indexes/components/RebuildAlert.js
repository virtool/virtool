import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Icon, WarningAlert } from "../../base";
import { checkRefRight } from "../../utils/utils";

const RebuildAlert = ({ refId, showCountAlert, showIndexAlert }) => {
    if (showCountAlert === 0) {
        return (
            <WarningAlert level>
                <Icon name="exclamation-circle" />
                At least one OTU must be added to the database before an index can be built.
            </WarningAlert>
        );
    }

    if (showIndexAlert) {
        const to = {
            pathname: `/refs/${refId}/indexes`,
            state: { rebuild: true }
        };

        return (
            <WarningAlert level>
                <Icon name="info-circle" />
                <span>
                    <span>There are unbuilt changes. </span>
                    <Link to={to}>Rebuild the index</Link>
                    <span> to use the changes in future analyses.</span>
                </span>
            </WarningAlert>
        );
    }

    return null;
};

const mapStateToProps = state => ({
    refId: state.references.detail.id,
    showIndexAlert: state.indexes.modified_otu_count || state.otus.modified_count,
    showCountAlert: checkRefRight(state, "build") && (state.indexes.total_otu_count || state.otus.total_count)
});

export default connect(mapStateToProps)(RebuildAlert);
