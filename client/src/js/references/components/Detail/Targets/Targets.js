import { map, reject } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, BoxGroupSection, NoneFound } from "../../../../base";
import { checkRefRight } from "../../../../utils/utils";
import { editReference } from "../../../actions";
import AddTarget from "./Add";
import EditTarget from "./Edit";
import { TargetItem } from "./Item";

const TargetsHeader = styled(BoxGroupHeader)`
    h2 {
        display: flex;
        justify-content: space-between;
    }
`;

const getInitialState = () => ({
    showAdd: false,
    showEdit: false
});

export class Targets extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState();
    }

    handleHide = () => {
        this.setState({ showAdd: false, showEdit: false });
    };

    showAdd = () => {
        this.setState({ showAdd: true });
    };

    showEdit = name => {
        this.setState({ showEdit: true, activeName: name });
    };

    handleRemove = name => {
        this.props.onRemove(this.props.refId, {
            targets: reject(this.props.targets, { name })
        });
    };

    render() {
        const targetComponents = map(this.props.targets, target => (
            <TargetItem
                key={target.name}
                {...target}
                canModify={this.props.canModify}
                onEdit={this.showEdit}
                onRemove={this.handleRemove}
            />
        ));

        let addButton;
        let modals;

        if (this.props.canModify) {
            addButton = (
                <a href="#" onClick={this.showAdd}>
                    Add target
                </a>
            );

            modals = (
                <React.Fragment>
                    <AddTarget show={this.state.showAdd} onHide={this.handleHide} />
                    <EditTarget
                        show={this.state.showEdit}
                        onHide={this.handleHide}
                        activeName={this.state.activeName}
                    />
                </React.Fragment>
            );
        }

        const none = (
            <BoxGroupSection>
                <NoneFound />
            </BoxGroupSection>
        );

        return (
            <BoxGroup>
                <TargetsHeader>
                    <h2>
                        <span>Targets</span>
                        {addButton}
                    </h2>
                    <p>Manage the allowable sequence targets for this barcode reference.</p>
                </TargetsHeader>

                <div>{targetComponents.length ? targetComponents : none}</div>

                {modals}
            </BoxGroup>
        );
    }
}

export const mapStateToProps = state => ({
    canModify: checkRefRight(state, "modify"),
    refId: state.references.detail.id,
    targets: state.references.detail.targets
});

export const mapDispatchToProps = dispatch => ({
    onRemove: (refId, update) => {
        dispatch(editReference(refId, update));
    }
});
export default connect(mapStateToProps, mapDispatchToProps)(Targets);
