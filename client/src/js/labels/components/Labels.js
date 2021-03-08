import { get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { BoxGroup, BoxGroupHeader, LoadingPlaceholder, NarrowContainer, ViewHeader, ViewHeaderTitle } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import { listLabels } from "../actions";
import { getLabels } from "../selectors";
import CreateLabel from "./Create";
import EditLabel from "./Edit";
import { Item } from "./Item";
import RemoveLabel from "./Remove";

const LabelsHeader = styled(BoxGroupHeader)`
    h2 {
        align-items: center;
        display: flex;

        justify-content: space-between;
    }
`;

export class Labels extends React.Component {
    componentDidMount = () => {
        this.props.onLoadLabels();
    };

    render() {
        if (this.props.labels === null) {
            return <LoadingPlaceholder />;
        }

        const labels = map(this.props.labels, label => (
            <Item
                key={label.id}
                name={label.name}
                color={label.color}
                description={label.description}
                id={label.id}
                removeLabel={this.onRemove}
                editLabel={this.onEdit}
            />
        ));

        return (
            <NarrowContainer>
                <ViewHeader title="Labels">
                    <ViewHeaderTitle>Labels</ViewHeaderTitle>
                </ViewHeader>
                <BoxGroup>
                    <LabelsHeader>
                        <h2>
                            Labels
                            <Link color="blue" to={{ state: { createLabel: true } }}>
                                Create Label
                            </Link>
                        </h2>
                        <p>Labels can help organize samples.</p>
                    </LabelsHeader>
                    {labels}
                </BoxGroup>
                <CreateLabel />
                <EditLabel />
                <RemoveLabel />
            </NarrowContainer>
        );
    }
}

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "removeLabel"),
    labels: getLabels(state),
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onLoadLabels: () => {
        dispatch(listLabels());
    },

    onHide: () => {
        dispatch(pushState({ removeLabel: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Labels);
