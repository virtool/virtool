import React from "react";
import { connect } from "react-redux";
import { Flex, FlexItem, Icon, LinkBox, Loader } from "../../base";

export const SubtractionItemIcon = ({ ready }) => {
    if (ready) {
        return <Icon name="check" color="green" />;
    }

    return <Loader size="14px" color="#3c8786" />;
};

export const SubtractionItem = ({ id, name, ready }) => (
    <LinkBox key={id} to={`/subtraction/${id}`}>
        <strong>{name}</strong>
        <Flex alignItems="center" className="pull-right">
            <SubtractionItemIcon ready={ready} />
            <FlexItem pad>
                <strong>{ready ? "Ready" : "Importing"}</strong>
            </FlexItem>
        </Flex>
    </LinkBox>
);

export const mapStateToProps = (state, props) => {
    const { id, name, ready } = state.subtraction.documents[props.index];
    return {
        id,
        name,
        ready
    };
};

export default connect(mapStateToProps)(SubtractionItem);
