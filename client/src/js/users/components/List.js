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
import { getUpdatedScrollListState } from "../../utils";

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

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page
        };
    }

    componentDidMount () {
        this.props.loadNextPage(1);
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        return getUpdatedScrollListState(nextProps, prevState);
    }

    rowRenderer = (index) => (
        <UserEntry
            key={this.state.masterList[index].id}
            {...this.state.masterList[index]}
            isAdmin={this.state.masterList[index].administrator}
        />
    );

    render () {
        return (
            <ScrollList
                hasNextPage={this.props.page < this.props.page_count}
                isNextPageLoading={this.props.isLoading}
                isLoadError={this.props.errorLoad}
                list={this.state.masterList}
                loadNextPage={this.props.loadNextPage}
                page={this.state.page}
                rowRenderer={this.rowRenderer}
            />
        );
    }
}

const mapStateToProps = state => ({
    ...state.users.list
});

const mapDispatchToProps = (dispatch) => ({
    loadNextPage: (page) => {
        if (page) {
            dispatch(listUsers(page));
        }
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UsersList);
