import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Button, Icon, WarningAlert } from "../../base";

import { checkRefRight } from "../../utils/utils";
import RebuildIndex from "./Rebuild";

const RebuildAlert = ({ canBuild, modifiedCount, totalCount }) => {
    if (totalCount === 0) {
        return (
            <WarningAlert level>
                <Icon name="exclamation-circle" />
                At least one OTU must be added to the database before an index can be built.
            </WarningAlert>
        );
    }

    if (modifiedCount) {
        const button = canBuild ? (
            <LinkContainer to={{ state: { rebuild: true } }}>
                <Button bsStyle="warning" icon="wrench" pullRight>
                    Rebuild
                </Button>
            </LinkContainer>
        ) : null;

        return (
            <React.Fragment>
                <WarningAlert>
                    <Icon name="exclamation-circle" />
                    <span>
                        The reference has unbuilt changes. A new index must be built before the information will be
                        included in future analyses.
                    </span>
                    {button}
                </WarningAlert>
                <RebuildIndex />
            </React.Fragment>
        );
    }

    return null;
};

const mapStateToProps = state => ({
    canBuild: checkRefRight(state, "build"),
    modifiedCount: state.indexes.modified_otu_count,
    totalCount: state.indexes.total_otu_count
});

export default connect(mapStateToProps)(RebuildAlert);
