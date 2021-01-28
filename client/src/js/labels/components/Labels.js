import { get, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, RemoveModal, ViewHeader, ViewHeaderTitle } from "../../base";
import { listLabels, removeLabel } from "../actions";
import { routerLocationHasState } from "../../utils/utils";
import { pushState } from "../../app/actions";
import CreateLabel from "./Create";
import EditLabel from "./Edit";
import { Item } from "./Item";

const LabelsHeader = styled(BoxGroupHeader)`
    h2 {
        align-items: center;
        display: flex;

        justify-content: space-between;
    }
`;

export class Labels extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            id: ""
        };
    }

    componentDidMount = () => {
        this.props.onLoadLabels();
    };

    removeLabel = () => {
        this.props.removeLabel(this.state.id);
        this.props.onHide();
    };

    onEdit = id => {
        this.setState({
            id
        });
    };

    onRemove = (id, name) => {
        this.setState({
            id,
            name
        });
    };

    render() {
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
            <div>
                <ViewHeader title="Label Editor">
                    <ViewHeaderTitle>Label Editor</ViewHeaderTitle>
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
                <EditLabel id={this.state.id} />
                <RemoveModal
                    noun="Label"
                    name={this.state.name}
                    show={this.props.show}
                    onConfirm={this.removeLabel}
                    onHide={this.props.onHide}
                />
            </div>
        );
    }
}

export const mapStateToProps = state => ({
    show: routerLocationHasState(state, "removeLabel"),
    labels: state.labels.list,
    error: get(state, "errors.UPDATE_SAMPLE_ERROR.message", "")
});

export const mapDispatchToProps = dispatch => ({
    onLoadLabels: () => {
        dispatch(listLabels());
    },

    removeLabel: id => {
        dispatch(removeLabel(id));
    },

    onHide: () => {
        dispatch(pushState({ removeLabel: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Labels);
