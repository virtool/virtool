import React from "react";
import { connect } from "react-redux";
import { ScrollList } from "../../../base";
import { findUsers } from "../../../users/actions";
import MemberItem from "./MemberItem";

class UsersList extends React.Component {
    constructor(props) {
        super(props);
        this.scrollContainer = React.createRef();
    }

    componentDidMount() {
        this.props.onLoadNextPage(1);
    }

    renderRow = index => {
        const isSelected = this.props.selected === this.props.documents[index].id;
        return (
            <MemberItem
                key={this.props.documents[index].id}
                onEdit={this.props.onEdit}
                onToggleSelect={this.props.onToggleSelect}
                add={isSelected}
                id={this.props.documents[index].id}
                identicon={this.props.documents[index].identicon}
                permissions={
                    isSelected
                        ? {
                              build: this.props.permissions.build,
                              modify: this.props.permissions.modify,
                              modify_otu: this.props.permissions.modify_otu,
                              remove: this.props.permissions.remove
                          }
                        : {
                              build: this.props.documents[index].build,
                              modify: this.props.documents[index].modify,
                              modify_otu: this.props.documents[index].modify_otu,
                              remove: this.props.documents[index].remove
                          }
                }
                isSelected={isSelected}
            />
        );
    };

    render() {
        return (
            <ScrollList
                ref={this.scrollContainer}
                documents={this.props.documents}
                onLoadNextPage={this.props.onLoadNextPage}
                page={this.props.page}
                pageCount={this.props.page_count}
                renderRow={this.renderRow}
                style={{ height: "300px", overflowY: "auto", padding: "15px" }}
                isElement
            />
        );
    }
}

const mapStateToProps = state => state.users.list;

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: page => {
        dispatch(findUsers(null, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UsersList);
