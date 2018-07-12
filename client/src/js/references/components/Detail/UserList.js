import React from "react";
import { connect } from "react-redux";
import MemberEntry from "./MemberEntry";
import { ScrollList } from "../../../base";
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

    componentDidMount () {
        this.props.loadNextPage(1);
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        return getUpdatedScrollListState(nextProps, prevState);
    }

    rowRenderer = (index) => {
        const isSelected = (this.props.selected === this.state.masterList[index].id);
        return (
            <MemberEntry
                key={this.state.masterList[index].id}
                onEdit={this.props.onEdit}
                onToggleSelect={this.props.onToggleSelect}
                add={isSelected}
                id={this.state.masterList[index].id}
                identicon={this.state.masterList[index].identicon}
                permissions={isSelected ? {
                    build: this.props.permissions.build,
                    modify: this.props.permissions.modify,
                    modify_otu: this.props.permissions.modify_otu,
                    remove: this.props.permissions.remove
                } : {
                    build: this.state.masterList[index].build,
                    modify: this.state.masterList[index].modify,
                    modify_otu: this.state.masterList[index].modify_otu,
                    remove: this.state.masterList[index].remove
                }}
                isSelected={isSelected}
            />
        );
    };

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

const mapStateToProps = state => ({
    page: state.users.list.page,
    page_count: state.users.list.page_count,
    errorLoad: state.users.errorLoad,
    isLoading: state.users.isLoading
});

const mapDispatchToProps = (dispatch) => ({
    loadNextPage: (page) => {
        if (page) {
            dispatch(listUsers(page));
        }
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UsersList);
