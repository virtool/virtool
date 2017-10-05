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
import { Label, Table, Panel } from "react-bootstrap";

import ChangePassword from "./Password";

class AccountGeneral extends React.Component {

    constructor (props) {
        super(props);
    }

    render () {
        const groupLabels = this.props.account.groups.map(groupId =>
            <Label key={groupId} style={{marginRight: "3px"}}>
                {capitalize(groupId)}
            </Label>
        );

        return (
            <div>
                <Panel header="Profile">
                    <Table bordered fill>
                        <tbody>
                            <tr>
                                <th className="col-xs-4">
                                    Name
                                </th>
                                <td className="col-xs-8">
                                    {this.props.account.id}
                                </td>
                            </tr>
                            <tr>
                                <th className="col-xs-4">
                                    Groups
                                </th>
                                <td className="col-xs-8">
                                    {groupLabels}
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </Panel>

                <ChangePassword />
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        account: state.account
    };
};

const mapDispatchToProps = () => {
    return {
        onChangePassword: () => {
            console.log("CHANGE PASSWORD");
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(AccountGeneral);

export default Container;
