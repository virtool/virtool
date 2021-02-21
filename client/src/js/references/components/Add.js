import React from "react";
import { connect } from "react-redux";
import { TabLink, ViewHeader, ViewHeaderTitle, Tabs, NarrowContainer } from "../../base";
import { routerLocationHasState } from "../../utils/utils";
import CloneReference from "./Clone";
import EmptyReference from "./Empty";
import ImportReference from "./Import";

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

        return <EmptyReference />;
    };

    render() {
        return (
            <NarrowContainer>
                <ViewHeader title="Create Reference">
                    <ViewHeaderTitle>Create Reference</ViewHeaderTitle>
                </ViewHeader>
                <Tabs>
                    <TabLink
                        to={{ state: { newReference: true, emptyReference: true } }}
                        isActive={this.checkActive("isCreate")}
                    >
                        Empty
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
                </Tabs>

                {this.renderForm()}
            </NarrowContainer>
        );
    }
}

const mapStateToProps = state => {
    const isClone = routerLocationHasState(state, "cloneReference");
    const isCreate = routerLocationHasState(state, "emptyReference");
    const isImport = routerLocationHasState(state, "importReference");
    return {
        isCreate,
        isImport,
        isClone
    };
};

export default connect(mapStateToProps)(AddReference);
