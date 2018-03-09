import React from "react";
import { includes } from "lodash-es";
import { Nav, NavItem } from "react-bootstrap";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { push } from "react-router-redux";
import { Switch, Route, Redirect } from "react-router-dom";

import Analyses from "./Analyses/Analyses";
import General from "./General";
import Quality from "./Quality/Quality";
import RemoveSample from "./Remove";
import Rights from "./Rights";
import { getSample, showRemoveSample, hideSampleModal } from "../actions";
import { Flex, FlexItem, Icon, LoadingPlaceholder } from "../../base";
import { getCanModify } from "../selectors";

class SampleDetail extends React.Component {

    componentDidMount () {
        this.props.getSample(this.props.match.params.sampleId);
    }

    componentWillUnmount () {
        this.props.onHide();
    }

    render () {

        if (this.props.detail === null) {
            return <LoadingPlaceholder margin={130} />;
        }

        if (this.props.detail.imported === "ip") {
            return (
                <LoadingPlaceholder
                    message="Sample is still being imported."
                    margin={220}
                />
            );
        }

        const detail = this.props.detail;
        const sampleId = this.props.match.params.sampleId;

        let editIcon;
        let removeIcon;

        if (this.props.canModify) {
            if (includes(this.props.history.location.pathname, "general")) {
                editIcon = (
                    <small style={{paddingLeft: "5px"}}>
                        <Icon
                            bsStyle="warning"
                            name="pencil"
                            tip="Edit Sample"
                            onClick={this.props.showEdit}
                        />
                    </small>
                );
            }

            removeIcon = (
                <small style={{paddingLeft: "5px"}}>
                    <Icon
                        bsStyle="danger"
                        name="remove"
                        tip="Remove Sample"
                        onClick={() => this.props.showRemove(sampleId, detail.name)}
                    />
                </small>
            );
        }

        return (
            <div>
                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                {detail.name}
                            </strong>
                        </FlexItem>

                        {editIcon}
                        {removeIcon}
                    </Flex>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/samples/${sampleId}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/samples/${sampleId}/quality`}>
                        <NavItem>Quality</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/samples/${sampleId}/analyses`}>
                        <NavItem>Analyses</NavItem>
                    </LinkContainer>
                    {this.props.canModify ? (
                        <LinkContainer to={`/samples/${sampleId}/rights`}>
                            <NavItem>
                                <Icon name="key" />
                            </NavItem>
                        </LinkContainer>
                    ) : null}
                </Nav>

                <Switch>
                    <Redirect from="/samples/:sampleId" to={`/samples/${sampleId}/general`} exact />
                    <Route path="/samples/:sampleId/general" component={General} />
                    <Route path="/samples/:sampleId/quality" component={Quality} />
                    <Route path="/samples/:sampleId/analyses" component={Analyses} />
                    <Route path="/samples/:sampleId/rights" component={Rights} />
                </Switch>

                <RemoveSample id={detail.id} name={detail.name} onHide={this.props.onHide} />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    detail: state.samples.detail,
    canModify: getCanModify(state)
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(hideSampleModal());
    },

    getSample: (sampleId) => {
        dispatch(getSample(sampleId));
    },

    showEdit: () => {
        dispatch(push({state: {editSample: true}}));
    },

    showRemove: (sampleId, sampleName) => {
        console.log({ sampleId, sampleName });
        dispatch(showRemoveSample(sampleId, sampleName));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleDetail);

export default Container;

