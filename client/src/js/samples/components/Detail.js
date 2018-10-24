import React from "react";
import { includes, get } from "lodash-es";
import { Nav, NavItem } from "react-bootstrap";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { push } from "react-router-redux";
import { Switch, Route, Redirect } from "react-router-dom";

import Analyses from "../../analyses/components/Analyses";
import { getSample, showRemoveSample, hideSampleModal } from "../actions";
import {
  Flex,
  FlexItem,
  Icon,
  LoadingPlaceholder,
  ViewHeader,
  RelativeTime,
  NotFound
} from "../../base";
import { getCanModify } from "../selectors";
import General from "./General";
import Quality from "./Quality/Quality";
import RemoveSample from "./Remove";
import Rights from "./Rights";

class SampleDetail extends React.Component {
  componentDidMount() {
    this.props.getSample(this.props.match.params.sampleId);
  }

  componentWillUnmount() {
    this.props.onHide();
  }

  render() {
    if (this.props.error) {
      return <NotFound />;
    }

    if (this.props.detail === null) {
      return <LoadingPlaceholder margin="130px" />;
    }

    if (this.props.detail.imported === "ip") {
      return (
        <LoadingPlaceholder
          message="Sample is still being imported."
          margin="220px"
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
          <small style={{ paddingLeft: "5px" }}>
            <Icon
              bsStyle="warning"
              name="pencil-alt"
              tip="Edit Sample"
              tipPlacement="left"
              onClick={this.props.showEdit}
            />
          </small>
        );
      }

      removeIcon = (
        <small style={{ paddingLeft: "5px" }}>
          <Icon
            bsStyle="danger"
            name="trash"
            tip="Remove Sample"
            tipPlacement="left"
            onClick={() => this.props.showRemove(sampleId, detail.name)}
          />
        </small>
      );
    }

    const { created_at, user } = this.props.detail;

    return (
      <div>
        <ViewHeader title={`${detail.name} - Samples`}>
          <Flex alignItems="flex-end">
            <FlexItem grow={1}>
              <strong>{detail.name}</strong>
            </FlexItem>

            {editIcon}
            {removeIcon}
          </Flex>
          <div className="text-muted" style={{ fontSize: "12px" }}>
            Created <RelativeTime time={created_at} /> by {user.id}
          </div>
        </ViewHeader>

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
          <Redirect
            from="/samples/:sampleId"
            to={`/samples/${sampleId}/general`}
            exact
          />
          <Route path="/samples/:sampleId/general" component={General} />
          <Route path="/samples/:sampleId/quality" component={Quality} />
          <Route path="/samples/:sampleId/analyses" component={Analyses} />
          <Route path="/samples/:sampleId/rights" component={Rights} />
        </Switch>

        <RemoveSample
          id={detail.id}
          name={detail.name}
          onHide={this.props.onHide}
        />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  error: get(state, "errors.GET_SAMPLE_ERROR", null),
  detail: state.samples.detail,
  canModify: getCanModify(state)
});

const mapDispatchToProps = dispatch => ({
  onHide: () => {
    dispatch(hideSampleModal());
  },

  getSample: sampleId => {
    dispatch(getSample(sampleId));
  },

  showEdit: () => {
    dispatch(push({ state: { editSample: true } }));
  },

  showRemove: (sampleId, sampleName) => {
    dispatch(showRemoveSample(sampleId, sampleName));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SampleDetail);
