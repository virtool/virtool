import React from "react";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem, Breadcrumb } from "react-bootstrap";
import { get } from "lodash-es";
import { getReference } from "../../../references/actions";
import { getOTU, showEditOTU, showRemoveOTU } from "../../actions";
import {
  Flex,
  FlexItem,
  Icon,
  LoadingPlaceholder,
  ViewHeader,
  NotFound
} from "../../../base";
import { checkUserRefPermission } from "../../../utils";
import AddIsolate from "./AddIsolate";
import IsolateEditor from "./Editor";
import EditOTU from "./EditOTU";
import General from "./General";
import History from "./History";
import RemoveOTU from "./RemoveOTU";
import Schema from "./Schema";

const OTUSection = ({ hasModifyOTU, match }) => (
  <div>
    <General />
    <IsolateEditor hasModifyOTU={hasModifyOTU} />
    <AddIsolate otuId={match.params.otuId} />
  </div>
);

class OTUDetail extends React.Component {
  componentDidMount() {
    this.props.getOTU(this.props.match.params.otuId);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.otuDetail === null && this.props.otuDetail !== null) {
      this.props.onGetReference(this.props.otuDetail.reference.id);
    }
  }

  render = () => {
    if (this.props.error) {
      return <NotFound />;
    }

    if (
      this.props.otuDetail === null ||
      this.props.otuDetail.id !== this.props.match.params.otuId ||
      this.props.detail === null
    ) {
      return <LoadingPlaceholder />;
    }

    const refId = this.props.otuDetail.reference.id;
    const { id, name, abbreviation } = this.props.otuDetail;

    const hasModifyOTU = checkUserRefPermission(this.props, "modify_otu");

    let iconButtons = [];
    let modifyOTUcomponents;

    if (!this.props.detail.remotes_from && hasModifyOTU) {
      iconButtons = (
        <span>
          <small key="edit-icon" style={{ paddingLeft: "5px" }}>
            <Icon
              bsStyle="warning"
              name="pencil-alt"
              tip="Edit OTU"
              tipPlacement="left"
              onClick={this.props.showEdit}
            />
          </small>

          <small key="remove-icon" style={{ paddingLeft: "5px" }}>
            <Icon
              bsStyle="danger"
              name="trash"
              tip="Remove OTU"
              tipPlacement="left"
              onClick={this.props.showRemove}
            />
          </small>
        </span>
      );

      modifyOTUcomponents = (
        <div>
          <EditOTU otuId={id} name={name} abbreviation={abbreviation} />
          <RemoveOTU otuId={id} otuName={name} history={this.props.history} />
        </div>
      );
    }

    return (
      <div>
        <ViewHeader title={`${name} - OTU`} />

        <Breadcrumb>
          <Breadcrumb.Item>
            <LinkContainer to="/refs/">
              <span>References</span>
            </LinkContainer>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <LinkContainer to={`/refs/${refId}`}>
              <span>{this.props.detail.name}</span>
            </LinkContainer>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <LinkContainer to={`/refs/${refId}/otus`}>
              <span>OTUs</span>
            </LinkContainer>
          </Breadcrumb.Item>
          <Breadcrumb.Item active>{this.props.otuDetail.name}</Breadcrumb.Item>
        </Breadcrumb>

        <h3 style={{ marginBottom: "20px" }}>
          <Flex alignItems="flex-end">
            <FlexItem grow={1}>
              <Flex alignItems="center">
                <strong>{name}</strong>
                <FlexItem grow={1} pad={5}>
                  <small className="text-strong">{abbreviation}</small>
                </FlexItem>
              </Flex>
            </FlexItem>
            {iconButtons}
          </Flex>
        </h3>

        <Nav bsStyle="tabs">
          <LinkContainer to={`/refs/${refId}/otus/${id}/otu`}>
            <NavItem>OTU</NavItem>
          </LinkContainer>

          <LinkContainer to={`/refs/${refId}/otus/${id}/schema`}>
            <NavItem>Schema</NavItem>
          </LinkContainer>

          <LinkContainer to={`/refs/${refId}/otus/${id}/history`}>
            <NavItem>History</NavItem>
          </LinkContainer>
        </Nav>

        {modifyOTUcomponents}

        <Switch>
          <Redirect
            from="/refs/:refId/otus/:otuId"
            to={`/refs/${refId}/otus/${id}/otu`}
            exact
          />
          <Route
            path="/refs/:refId/otus/:otuId/otu"
            render={({ match }) => (
              <OTUSection hasModifyOTU={hasModifyOTU} match={match} />
            )}
            match={window.location}
          />
          <Route
            path="/refs/:refId/otus/:otuId/history"
            render={() => <History hasModifyOTU={hasModifyOTU} />}
          />
          <Route
            path="/refs/:refId/otus/:otuId/schema"
            render={() => <Schema hasModifyOTU={hasModifyOTU} />}
          />
        </Switch>
      </div>
    );
  };
}

const mapStateToProps = state => ({
  error: get(state, "errors.GET_OTU_ERROR", null),
  otuDetail: state.otus.detail,
  isAdmin: state.account.administrator,
  userId: state.account.id,
  userGroups: state.account.groups,
  detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({
  getOTU: otuId => {
    dispatch(getOTU(otuId));
  },

  showEdit: () => {
    dispatch(showEditOTU());
  },

  showRemove: () => {
    dispatch(showRemoveOTU());
  },

  onGetReference: refId => {
    dispatch(getReference(refId));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(OTUDetail);
