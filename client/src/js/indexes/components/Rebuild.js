/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IndexRebuild
 */

import React, { PropTypes } from "react";
import { Alert, Collapse } from "react-bootstrap";

import { Flex, FlexItem, Icon, Button } from "virtool/js/components/Base";

const RebuildIndex = (props) => {

    console.log(props);

    let button;
    let message;

    // Show a notification
    if (props.modifiedCount > 0) {
        message = (
            <Flex alignItems="center">
                <Icon name="notification" />
                <FlexItem pad={10}>
                    The virus reference database has changed and the index must be rebuilt before the new
                    information will be included in future analyses.
                </FlexItem>
            </Flex>
        );

        if (props.canRebuild) {
            button = (
                <FlexItem pad={20}>
                    <Button
                        bsStyle="info"
                        icon="hammer"
                        onClick={props.rebuild}
                        pullRight
                    >
                        Rebuild
                    </Button>
                </FlexItem>
            );
        }

    } else {
        message = (
            <Flex alignItems="center">
                <Icon name="info" />
                <FlexItem pad={5}>
                    No viruses have been modified since the last index build.
                </FlexItem>
            </Flex>
        );
    }

    return (
        <div>
            <Alert bsStyle="info">
                <Flex alignItems="center">
                    <FlexItem grow={1}>
                        {message}
                    </FlexItem>
                    {button}
                </Flex>
            </Alert>

            <Collapse in={props.error}>
                <div>
                    <Alert bsStyle="danger" onDismiss={props.dismissError}>
                        <Icon name="warning" />&nbsp;
                        <strong>
                            One or more viruses are in an unverified state. All virus documents must be verified
                            before the index can be rebuilt.
                        </strong>
                    </Alert>
                </div>
            </Collapse>
        </div>
    );
};

RebuildIndex.propTypes = {
    error: PropTypes.bool,
    canRebuild: PropTypes.bool,
    modifiedCount: PropTypes.number,
    dismissError: PropTypes.func,
    rebuild: PropTypes.func
};

export default RebuildIndex;
