import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { Modal, ModalHeader, ModalTabs, TabLink } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import CloneReference from "./Clone";
import CreateReference from "./Create";

import ImportReference from "./Import";

const AddReferenceHeader = styled(ModalHeader)`
    border-bottom: none !important;
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
            <Modal label="Add Reference" show={this.props.show} onHide={this.handleHide}>
                <AddReferenceHeader>Add Reference</AddReferenceHeader>
                <ModalTabs>
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
                </ModalTabs>

                {this.renderForm()}
            </Modal>
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
