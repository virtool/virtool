import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Modal, Nav, NavItem } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { routerLocationHasState } from "../../utils";

import ImportReference from "./Import";
import CreateReference from "./Create";
import CloneReference from "./Clone";

export class AddReference extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            show: this.props.show,
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
        if (this.state.lock) {
            return;
        }

        this.setState({ show: false });
    };

    render() {
        if (this.props.noProps) {
            this.props.onHide();
            return null;
        }

        return (
            <Modal show={this.state.show} onHide={this.handleHide} onExited={this.props.onHide}>
                <Modal.Header onHide={this.handleHide} closeButton style={{ borderBottomWidth: "0" }}>
                    New Reference
                </Modal.Header>

                <Nav bsStyle="tabs" style={{ marginBottom: 0 }}>
                    <LinkContainer
                        to={{ state: { newReference: true, createReference: true } }}
                        isActive={this.checkActive("isCreate")}
                    >
                        <NavItem>Create</NavItem>
                    </LinkContainer>
                    <LinkContainer
                        to={{ state: { newReference: true, importReference: true } }}
                        isActive={this.checkActive("isImport")}
                    >
                        <NavItem>Import</NavItem>
                    </LinkContainer>
                    <LinkContainer
                        to={{ state: { newReference: true, cloneReference: true } }}
                        isActive={this.checkActive("isClone")}
                    >
                        <NavItem>Clone</NavItem>
                    </LinkContainer>
                </Nav>

                {this.props.isCreate ? <CreateReference /> : null}
                {this.props.isImport ? <ImportReference lock={this.checkModalLock} /> : null}
                {this.props.isClone ? <CloneReference /> : null}
            </Modal>
        );
    }
}

const mapStateToProps = state => {
    if (!state.router.location.state) {
        return { noProps: true };
    }

    const isCreate = state.router.location.state["createReference"];
    const isImport = state.router.location.state["importReference"];
    const isClone = state.router.location.state["cloneReference"];

    return {
        show: routerLocationHasState(state, "newReference"),
        isCreate,
        isImport,
        isClone
    };
};

const mapDispatchToProps = dispatch => ({
    onHide: () => {
        dispatch(push({ ...window.location, state: { newReference: false } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AddReference);
