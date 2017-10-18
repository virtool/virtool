/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";
import { capitalize } from "lodash";
import { connect } from "react-redux";
import { Label } from "react-bootstrap";

import { Flex, FlexItem } from "../../base";
import ChangePassword from "./Password";
import Identicon from "./Identicon";

class AccountGeneral extends React.Component {

    constructor (props) {
        super(props);
    }

    render () {
        const groupLabels = this.props.groups.map(groupId =>
            <Label key={groupId} style={{marginRight: "3px"}}>
                {capitalize(groupId)}
            </Label>
        );

        return (
            <div>
                <Flex alignItems="stretch">
                    <FlexItem>
                        <Identicon hash={this.props.hash} />
                    </FlexItem>
                    <FlexItem pad={10}>
                        <h5>
                            <strong>
                                {this.props.id}
                            </strong>
                        </h5>
                        <div>
                            {groupLabels}
                        </div>
                    </FlexItem>
                </Flex>

                <ChangePassword />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        id: state.account.id,
        hash: state.account.identicon,
        groups: state.account.groups
    };
};

const Container = connect(mapStateToProps)(AccountGeneral);

export default Container;
