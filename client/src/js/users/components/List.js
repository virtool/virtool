/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UsersList
 */
import React from "react";
import { filter, map, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";

import UserItem from "./User";

export const UsersList = (props) => {

    const re = new RegExp(props.filter);

    const users = sortBy(filter(props.users, user => user.id.match(re)), "id");

    const userComponents = map(users, user =>
        <UserItem
            key={user.id}
            {...user}
            active={user.id === props.match.params.activeId}
            isAdmin={user.administrator}
        />
    );

    return (
        <div>
            <ListGroup className="spaced">
                {userComponents}
            </ListGroup>
        </div>
    );
};

const mapStateToProps = state => ({
    users: state.users.list,
    filter: state.users.filter
});

export default connect(mapStateToProps)(UsersList);
