import React from "react";
import { connect } from "react-redux";
import { Alert } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";

import { checkRefRight } from "../../utils/utils";
import { Button, Flex, FlexItem, Icon } from "../../base";
import RebuildIndex from "./Rebuild";

const RebuildAlert = ({ canBuild, modifiedCount, totalCount }) => {
    if (totalCount === 0) {
        return (
            <Alert bsStyle="warning" icon="exclamation-circle">
                At least one OTU must be added to the database before an index can be built.
            </Alert>
        );
    }

    if (modifiedCount) {
        const button = canBuild ? (
            <FlexItem pad={20}>
                <LinkContainer to={{ state: { rebuild: true } }}>
                    <Button bsStyle="warning" icon="wrench" pullRight>
                        Rebuild
                    </Button>
                </LinkContainer>
            </FlexItem>
        ) : null;

        return (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <FlexItem grow={1}>
                        <Flex alignItems="center">
                            <Icon name="exclamation-circle" />
                            <FlexItem pad={10}>
                                The reference has unbuilt changes. A new index must be built before the information will
                                be included in future analyses.
                            </FlexItem>
                        </Flex>
                    </FlexItem>
                    {button}
                </Flex>

                <RebuildIndex />
            </Alert>
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
