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
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";
import { ScrollList, Flex, FlexItem, Identicon, Icon } from "../../base";
import { listUsers } from "../actions";

const UserEntry = ({ id, identicon, isAdmin }) => (
    <LinkContainer to={`/administration/users/${id}`} style={{paddingLeft: "10px"}}>
        <ListGroupItem className="spaced">
            <Flex alignItems="center">
                <Identicon size={32} hash={identicon} />
                <FlexItem pad={10}>
                    {id}
                </FlexItem>
                <FlexItem pad={10}>
                    {isAdmin ? <Icon name="user-shield" bsStyle="primary" /> : null}
                </FlexItem>
            </Flex>
        </ListGroupItem>
    </LinkContainer>
);

class UsersList extends React.Component {

    componentDidMount () {
        if (!this.props.fetched) {
            this.props.loadNextPage(1);
        }
    }

    rowRenderer = (index) => (
        <UserEntry
            key={this.props.documents[index].id}
            {...this.props.documents[index]}
            isAdmin={this.props.documents[index].administrator}
        />
    );

    render () {
        return (
            <ScrollList
                hasNextPage={this.props.page < this.props.page_count}
                isNextPageLoading={this.props.isLoading}
                isLoadError={this.props.errorLoad}
                list={this.props.documents}
                refetchPage={this.props.refetchPage}
                loadNextPage={this.props.loadNextPage}
                page={this.props.page}
                rowRenderer={this.rowRenderer}
            />
        );
    }
}

const mapStateToProps = state => ({
    ...state.users.list,
    fetched: state.users.fetched,
    refetchPage: state.users.refetchPage,
    isLoading: state.users.isLoading,
    errorLoad: state.users.errorLoad
});

const mapDispatchToProps = (dispatch) => ({
    loadNextPage: (page) => {
        if (page) {
            dispatch(listUsers(page));
        }
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UsersList);
