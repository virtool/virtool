import React from "react";
import PropTypes from "prop-types";
import { ListGroupItem, Icon, Identicon, Flex, FlexItem } from "../../../base";

class MemberItem extends React.Component {
    static propTypes = {
        canModify: PropTypes.bool.isRequired,
        id: PropTypes.string.isRequired,
        identicon: PropTypes.string,
        onEdit: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired
    };

    handleEdit = () => {
        this.props.onEdit(this.props.id);
    };

    handleRemove = () => {
        this.props.onRemove(this.props.id);
    };

    render() {
        let icons;

        if (this.props.canModify) {
            icons = (
                <FlexItem grow={1} shrink={1}>
                    <Flex alignItems="center" className="pull-right">
                        <Icon name="edit" bsStyle="warning" tip="Modify" onClick={this.handleEdit} />
                        <FlexItem pad>
                            <Icon name="trash" bsStyle="danger" tip="Remove" onClick={this.handleRemove} />
                        </FlexItem>
                    </Flex>
                </FlexItem>
            );
        }

        let identicon;

        if (this.props.identicon) {
            identicon = (
                <FlexItem grow={0} shrink={0} style={{ paddingRight: "8px" }}>
                    <Identicon size={24} hash={this.props.identicon} />
                </FlexItem>
            );
        }

        return (
            <ListGroupItem>
                <Flex alignItems="center">
                    {identicon}
                    {this.props.id}
                    {icons}
                </Flex>
            </ListGroupItem>
        );
    }
}

export default MemberItem;
