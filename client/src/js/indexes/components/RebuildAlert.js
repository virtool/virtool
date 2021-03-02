import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Alert, Icon } from "../../base";
import { checkReferenceRight } from "../../references/selectors";

export const RebuildAlert = ({ refId, showCountAlert, showIndexAlert }) => {
    if (showCountAlert === 0) {
        return (
            <Alert color="orange" level>
                <Icon name="exclamation-circle" />
                <strong>At least one OTU must be added to the database before an index can be built.</strong>
            </Alert>
        );
    }

    if (showIndexAlert) {
        const to = {
            pathname: `/refs/${refId}/indexes`,
            state: { rebuild: true }
        };

        return (
            <Alert color="orange" level>
                <Icon name="info-circle" />
                <span>
                    <span>There are unbuilt changes. </span>
                    <Link to={to}>Rebuild the index</Link>
                    <span> to use the changes in future analyses.</span>
                </span>
            </Alert>
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    refId: state.references.detail.id,
    showIndexAlert: state.indexes.modified_otu_count || state.otus.modified_count,
    showCountAlert: checkReferenceRight(state, "build") && (state.indexes.total_otu_count || state.otus.total_count)
});

export default connect(mapStateToProps)(RebuildAlert);
