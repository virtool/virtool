import React from "react";
import { capitalize, map } from "lodash-es";
import { connect } from "react-redux";
import { Label } from "react-bootstrap";

import { Flex, FlexItem, Identicon } from "../../base";
import ChangePassword from "./Password";
import Email from "./Email";

export const AccountGeneral = ({ id, groups, hash }) => {

    const groupLabels = map(groups, groupId =>
        <Label key={groupId} style={{marginRight: "3px"}}>
            {capitalize(groupId)}
        </Label>
    );

    return (
        <div>
            <Flex alignItems="stretch" style={{marginBottom: "15px"}}>
                <FlexItem>
                    <Identicon hash={hash} />
                </FlexItem>
                <FlexItem pad={10}>
                    <h5>
                        <strong>
                            {id}
                        </strong>
                    </h5>
                    <div>
                        {groupLabels}
                    </div>
                </FlexItem>
            </Flex>

            <Email />
            <ChangePassword />
        </div>
    );
};

const mapStateToProps = (state) => ({
    id: state.account.id,
    hash: state.account.identicon,
    groups: state.account.groups
});

export default connect(mapStateToProps)(AccountGeneral);
