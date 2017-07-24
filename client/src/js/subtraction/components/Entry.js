/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostEntry
 */

import React from "react";
import { pick } from "lodash";
import { Flex, FlexItem, ListGroupItem } from "virtool/js/components/Base";

/**
 * A component that serves as an document row in the hosts table.
 */
const HostEntry = (props) => (
    <ListGroupItem onClick={() => props.showModal(pick(props, ["id"]))} disabled={!props.added}>
        <Flex>
            <FlexItem grow={1}>
                {props.id}
            </FlexItem>
        </Flex>
    </ListGroupItem>
);

HostEntry.propTypes = {
    id: React.PropTypes.string,
    added: React.PropTypes.bool,
    ready: React.PropTypes.bool,
    showModal: React.PropTypes.func,
};

export default HostEntry;
