import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";

import { Flex, FlexItem, Icon, Identicon, Label } from "../../base";
import Email from "./Email";
import ChangePassword from "./Password";

const AccountProfileLabel = styled(Label)`
    margin-right: 3px;
    text-transform: capitalize;
`;

export const AccountProfile = ({ id, groups, identicon, administrator }) => {
    const groupLabels = map(groups, groupId => <AccountProfileLabel key={groupId}>{groupId}</AccountProfileLabel>);

    let adminLabel;

    if (administrator) {
        adminLabel = (
            <AccountProfileLabel key="administrator" bsStyle="primary">
                Administrator
            </AccountProfileLabel>
        );
    }

    return (
        <div>
            <Flex alignItems="stretch" style={{ marginBottom: "15px" }}>
                <FlexItem>
                    <Identicon hash={identicon} />
                </FlexItem>
                <FlexItem pad={10}>
                    <h5>
                        <strong>
                            {id} {administrator ? <Icon name="user-shield" color="blue" /> : null}
                        </strong>
                    </h5>
                    <div>
                        {adminLabel}
                        {groupLabels}
                    </div>
                </FlexItem>
            </Flex>

            <Email />
            <ChangePassword />
        </div>
    );
};

export const mapStateToProps = state => ({
    id: state.account.id,
    identicon: state.account.identicon,
    groups: state.account.groups,
    administrator: state.account.administrator
});

export default connect(mapStateToProps)(AccountProfile);
