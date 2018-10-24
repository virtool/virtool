import React from "react";
import { map, sortBy, forEach } from "lodash-es";
import { connect } from "react-redux";
import {
  Alert,
  FormControl,
  FormGroup,
  InputGroup,
  ListGroup
} from "react-bootstrap";
import { Link } from "react-router-dom";

import { analyze, filterAnalyses } from "../actions";
import { getCanModify } from "../../samples/selectors";
import { listReadyIndexes } from "../../indexes/actions";
import { listHmms } from "../../hmm/actions";
import {
  Icon,
  Button,
  LoadingPlaceholder,
  NoneFound,
  Flex,
  FlexItem
} from "../../base/index";
import CreateAnalysis from "./Create";
import AnalysisItem from "./Item";

export const AnalysesToolbar = ({ term, onFilter, onClick, isDisabled }) => (
  <div className="toolbar">
    <FormGroup>
      <InputGroup>
        <InputGroup.Addon>
          <Icon name="search" />
        </InputGroup.Addon>
        <FormControl
          type="text"
          value={term}
          onChange={onFilter}
          placeholder="User or reference"
        />
      </InputGroup>
    </FormGroup>
    <Button
      icon="plus-square fa-fw"
      tip="New Analysis"
      bsStyle="primary"
      onClick={onClick}
      disabled={isDisabled}
    />
  </div>
);

export class AnalysesList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      show: false
    };
  }

  componentDidMount() {
    this.props.onListHMMs();
    this.props.onListReadyIndexes();
  }

  handleFilter = e => {
    this.props.onFilter(this.props.sampleId, e.target.value);
  };

  render() {
    if (
      this.props.analyses === null ||
      this.props.hmms.documents === null ||
      this.props.indexes === null
    ) {
      return <LoadingPlaceholder margin="37px" />;
    }

    // The content that will be shown below the "New Analysis" form.
    let listContent;

    if (this.props.analyses.length) {
      // The components that detail individual analyses.
      listContent = map(
        sortBy(this.props.analyses, "created_at").reverse(),
        (document, index) => <AnalysisItem key={index} {...document} />
      );
    } else {
      listContent = <NoneFound noun="analyses" noListGroup />;
    }

    let hmmAlert;

    if (!this.props.hmms.status.installed) {
      hmmAlert = (
        <Alert bsStyle="warning">
          <Flex alignItems="center">
            <Icon name="info-circle" />
            <FlexItem pad={5}>
              <span>The HMM data is not installed. </span>
              <Link to="/hmm">Install HMMs</Link>
              <span> to use in further NuV analyses.</span>
            </FlexItem>
          </Flex>
        </Alert>
      );
    }

    return (
      <div>
        {hmmAlert}

        <AnalysesToolbar
          term={this.props.filter}
          onFilter={this.handleFilter}
          onClick={() => this.setState({ show: true })}
          isDisabled={!this.props.canModify}
        />

        <ListGroup>{listContent}</ListGroup>

        <CreateAnalysis
          id={this.props.detail.id}
          show={this.state.show}
          onHide={() => this.setState({ show: false })}
          onSubmit={this.props.onAnalyze}
          hasHmm={!!this.props.hmms.status.installed}
          refIndexes={this.props.indexes}
          userId={this.props.userId}
        />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  userId: state.account.id,
  sampleId: state.analyses.sampleId,
  detail: state.samples.detail,
  analyses: state.analyses.documents,
  filter: state.analyses.filter,
  indexes: state.analyses.readyIndexes,
  hmms: state.hmms,
  canModify: getCanModify(state)
});

const mapDispatchToProps = dispatch => ({
  onFilter: (sampleId, term) => {
    dispatch(filterAnalyses(sampleId, term));
  },

  onAnalyze: (sampleId, references, algorithm, userId) => {
    forEach(references, entry =>
      dispatch(analyze(sampleId, entry.refId, algorithm, userId))
    );
  },

  onListHMMs: () => {
    dispatch(listHmms());
  },

  onListReadyIndexes: () => {
    dispatch(listReadyIndexes());
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AnalysesList);
