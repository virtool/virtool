import { isEqual, reduce } from "lodash-es";
import { format } from "date-fns";
import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";

import { Button, ButtonToolbar, RelativeTime, SpacedBox } from "../../../base/index";
import { removeAPIKey, updateAPIKey } from "../../actions";
import APIPermissions from "./Permissions";

const FormatDate = styled.div`
    @media (min-width: 892px) {
        display: none;
    }
`;

const Create = styled.div`
    @media (max-width: 892px) {
        display: none;
    }
`;

const Permissions = styled.div`
    display: flex;
    flex-direction: row;
`;

const PermissionsPostfix = styled.div`
    @media (max-width: 892px) {
        display: none;
    }
`;

const KeyHeader = styled.div`
    display: flex;
    justify-content: space-between;
`;
export const getInitialState = ({ apiKey }) => ({
    in: false,
    changed: false,
    permissions: apiKey.permissions
});

const KeyAPIPermissions = styled(APIPermissions)`
    margin-top: 15px;
`;

export class APIKey extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(props);
    }

    toggleIn = () => {
        const state = {
            in: !this.state.in
        };

        if (this.state.in) {
            state.permissions = this.props.apiKey.permissions;
        }

        this.setState(state);
    };

    onPermissionChange = (key, value) => {
        const permissions = { ...this.state.permissions, [key]: value };

        this.setState({
            changed: !isEqual(permissions, this.props.apiKey.permissions),
            permissions
        });
    };

    render() {
        let lower;
        let closeButton;

        if (this.state.in) {
            lower = (
                <div>
                    <KeyAPIPermissions
                        userPermissions={this.props.permissions}
                        keyPermissions={this.state.permissions}
                        onChange={this.onPermissionChange}
                    />

                    <ButtonToolbar>
                        <Button bsStyle="danger" icon="trash" onClick={() => this.props.onRemove(this.props.apiKey.id)}>
                            Remove
                        </Button>
                        <Button
                            bsStyle="primary"
                            icon="save"
                            onClick={() => this.props.onUpdate(this.props.apiKey.id, this.state.permissions)}
                            disabled={!this.state.changed}
                        >
                            Update
                        </Button>
                    </ButtonToolbar>
                </div>
            );

            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
            );
        }

        const permissionCount = reduce(this.props.apiKey.permissions, (result, value) => result + (value ? 1 : 0), 0);

        return (
            <SpacedBox key={this.props.apiKey.id} onClick={this.state.in ? null : this.toggleIn}>
                <KeyHeader>
                    <strong>{this.props.apiKey.name}</strong>
                    <Permissions>
                        {permissionCount} perm
                        <PermissionsPostfix>ission</PermissionsPostfix>
                        {permissionCount === 1 ? null : "s"}
                    </Permissions>
                    <Create>
                        Created <RelativeTime time={this.props.apiKey.created_at} />
                    </Create>
                    <FormatDate>{format(new Date(this.props.apiKey.created_at), "yy-mm-dd")}</FormatDate>
                    {closeButton}
                </KeyHeader>
                {lower}
            </SpacedBox>
        );
    }
}

export const mapStateToProps = state => ({
    permissions: state.account.permissions
});

export const mapDispatchToProps = dispatch => ({
    onUpdate: (keyId, permissions) => {
        dispatch(updateAPIKey(keyId, permissions));
    },

    onRemove: keyId => {
        dispatch(removeAPIKey(keyId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(APIKey);
