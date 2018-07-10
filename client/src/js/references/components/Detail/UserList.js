import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "react-bootstrap";

import MemberEntry from "./MemberEntry";
import { ScrollList, Flex, FlexItem, Identicon, Icon } from "../../../base";
import { listUsers } from "../../../users/actions";
import { getUpdatedScrollListState } from "../../../utils";

class UsersList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page
        };

        this.scrollContainer = React.createRef();
    }
/*
    componentDidMount () {
        //this.props.loadNextPage(1);
    //    console.log("scrollContainer: ", this.scrollContainer.current);
    //    console.log("scrolllist: ", this.scrollContainer.current.scrollList.current);

    //    console.log("testing: ", this.scrollContainer.clientHeight);
    }
*/
    static getDerivedStateFromProps (nextProps, prevState) {
        return getUpdatedScrollListState(nextProps, prevState);
    }

    rowRenderer = (index) => (
        <MemberEntry
            key={this.state.masterList[index].id}
            onEdit={this.props.edit}
            onToggleSelect={this.props.onToggleSelect}
            add={this.props.selected === this.state.masterList[index].id}
            id={this.state.masterList[index].id}
            identicon={this.state.masterList[index].identicon}
            permissions={{
                build: this.state.masterList[index].build,
                modify: this.state.masterList[index].modify,
                modify_otu: this.state.masterList[index].modify_otu,
                remove: this.state.masterList[index].remove
            }}
            isSelected={this.props.selected === this.state.masterList[index].id}
        />
    );

    render () {
        return (
            <ScrollList
                ref={this.scrollContainer}
                hasNextPage={this.props.page < this.props.page_count}
                isNextPageLoading={this.props.isLoading}
                isLoadError={this.props.errorLoad}
                list={this.state.masterList}
                loadNextPage={this.props.loadNextPage}
                page={this.state.page}
                rowRenderer={this.rowRenderer}
                style={{height: "300px", overflowY: "auto", padding: "15px"}}
                isElement
            />
        );
    }
}
/*
const mapStateToProps = state => ({
    ...state.users.list
});
*/
const mapDispatchToProps = (dispatch) => ({
    loadNextPage: (page) => {
        dispatch(listUsers(page));
    }
});

export default connect(null, mapDispatchToProps)(UsersList);
