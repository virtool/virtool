import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Alert, device, Icon, LoadingPlaceholder, RemoveBanner } from "../../base";
import { listGroups } from "../../groups/actions";
import { getUser, removeUser } from "../actions";
import { getCanModifyUser } from "../selectors";
import UserGroups from "./Groups";
import Password from "./Password";
import UserPermissions from "./Permissions";
import PrimaryGroup from "./PrimaryGroup";
import UserRole from "./Role";

const AdminIcon = styled(Icon)`
    padding-left: 10px;
`;

const UserDetailGroups = styled.div`
    margin-bottom: 15px;

    @media (min-width: ${device.tablet}) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-column-gap: ${props => props.theme.gap.column};
    }
`;

const UserDetailHeader = styled.div`
    display: flex;
    margin-bottom: 20px;
`;

const UserDetailTitle = styled.div`
    align-items: center;
    display: flex;
    flex: 1 0 auto;
    font-size: ${getFontSize("xl")};
    font-weight: ${getFontWeight("bold")};
    margin-left: 15px;

    a {
        font-size: ${getFontSize("md")};
        margin-left: auto;
    }
`;

export class UserDetail extends React.Component {
    componentDidMount() {
        this.props.onGetUser(this.props.match.params.userId);
        this.props.onListGroups();
    }

    handleRemove = () => {
        this.props.onRemoveUser(this.props.detail.id);
    };

    render() {
        if (this.props.error.length) {
            return (
                <Alert color="orange" level>
                    <Icon name="exclamation-circle" />
                    <span>
                        <strong>You do not have permission to manage users.</strong>
                        <span> Contact an administrator.</span>
                    </span>
                </Alert>
            );
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const { id, administrator } = this.props.detail;

        return (
            <div>
                <UserDetailHeader>
                    <UserDetailTitle>
                        <span>{id}</span>
                        {administrator ? <AdminIcon name="user-shield" color="blue" /> : null}
                        <Link to="/administration/users">Back To List</Link>
                    </UserDetailTitle>
                </UserDetailHeader>

                <Password key={this.props.lastPasswordChange} />

                <UserDetailGroups>
                    <div>
                        <UserGroups />
                        <PrimaryGroup />
                    </div>
                    <UserPermissions />
                </UserDetailGroups>

                <UserRole />

                {this.props.canModifyUser ? (
                    <RemoveBanner
                        message="Permanently remove this user"
                        buttonText="Delete"
                        onClick={this.handleRemove}
                    />
                ) : null}
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    canModifyUser: getCanModifyUser(state),
    detail: state.users.detail,
    error: get(state, "errors.GET_USER_ERROR.message", ""),
    lastPasswordChange: get(state, "users.detail.last_password_change")
});

export const mapDispatchToProps = dispatch => ({
    onGetUser: userId => {
        dispatch(getUser(userId));
    },

    onRemoveUser: userId => {
        dispatch(removeUser(userId));
    },

    onListGroups: () => {
        dispatch(listGroups());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UserDetail);
