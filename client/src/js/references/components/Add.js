import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { TabLink, Tabs, ModalDialog } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import CloneReference from "./Clone";
import CreateReference from "./Create";

import ImportReference from "./Import";

const AddReferenceTabs = styled(Tabs)`
    margin-bottom: 0;
`;

export class AddReference extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            lock: false
        };
    }

    componentDidUpdate(prevProps) {
        if (this.props.show !== prevProps.show) {
            this.setState({ show: this.props.show });
        }
    }

    checkActive = current => () => this.props[current];

    checkModalLock = isLocked => {
        if (isLocked) {
            return this.setState({ lock: true });
        }
        this.setState({ lock: false });
    };

    handleHide = () => {
        if (!this.state.lock) {
            this.props.onHide();
        }
    };

    renderForm = () => {
        if (this.props.isImport) {
            return <ImportReference lock={this.checkModalLock} />;
        }

        if (this.props.isClone) {
            return <CloneReference />;
        }

        return <CreateReference />;
    };

    render() {
        return (
            <ModalDialog
                label="AddReference"
                headerText="New Reference"
                show={this.props.show}
                onHide={this.handleHide}
                onExited={this.props.onHide}
                headerBorderBottom="none"
            >
                <AddReferenceTabs>
                    <TabLink
                        to={{ state: { newReference: true, createReference: true } }}
                        isActive={this.checkActive("isCreate")}
                    >
                        Create
                    </TabLink>
                    <TabLink
                        to={{ state: { newReference: true, importReference: true } }}
                        isActive={this.checkActive("isImport")}
                    >
                        Import
                    </TabLink>
                    <TabLink
                        to={{ state: { newReference: true, cloneReference: true } }}
                        isActive={this.checkActive("isClone")}
                    >
                        Clone
                    </TabLink>
                </AddReferenceTabs>

                {this.renderForm()}
            </ModalDialog>
        );
    }
}

const mapStateToProps = state => {
    const isClone = routerLocationHasState(state, "cloneReference");
    const isCreate = routerLocationHasState(state, "createReference");
    const isImport = routerLocationHasState(state, "importReference");

    return {
        show: routerLocationHasState(state, "newReference"),
        isCreate,
        isImport,
        isClone
    };
};

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(pushState({ newReference: false }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddReference);
