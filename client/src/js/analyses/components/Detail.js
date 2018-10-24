import { get } from "lodash-es";
import numbro from "numbro";
import React from "react";
import { Label, Panel, Table } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
  IDRow,
  LoadingPlaceholder,
  NotFound,
  RelativeTime
} from "../../base/index";
import { getTaskDisplayName } from "../../utils";
import { clearAnalysis, getAnalysis } from "../actions";
import NuVsViewer from "./NuVs/Viewer";
import PathoscopeViewer from "./Pathoscope/Viewer";

class AnalysisDetail extends React.Component {
  componentDidMount() {
    this.props.getAnalysis(this.props.match.params.analysisId);
  }

  componentWillUnmount() {
    this.props.clearAnalysis();
  }

  render() {
    if (this.props.error) {
      return <NotFound />;
    }

    if (this.props.detail === null) {
      return <LoadingPlaceholder />;
    }

    const detail = this.props.detail;

    let content;

    if (!detail.ready) {
      content = (
        <Panel>
          <Panel.Body>
            <LoadingPlaceholder
              message="Analysis in progress"
              margin="1.2rem"
            />
          </Panel.Body>
        </Panel>
      );
    } else if (detail.algorithm === "pathoscope_bowtie") {
      content = (
        <PathoscopeViewer
          {...detail}
          maxReadLength={this.props.quality.length[1]}
        />
      );
    } else if (detail.algorithm === "nuvs") {
      content = (
        <NuVsViewer
          history={this.props.history}
          location={this.props.location}
          {...detail}
        />
      );
    } else {
      throw Error("Unusable analysis detail content");
    }

    const mappedPercent = numbro(
      detail.read_count / this.props.quality.count
    ).format("0.00%");

    return (
      <div>
        <Table bordered>
          <tbody>
            <tr>
              <th className="col-md-3">Algorithm</th>
              <td className="col-md-9">
                {getTaskDisplayName(detail.algorithm)}
              </td>
            </tr>
            <tr>
              <th>Reference</th>
              <td>
                <Link to={`/refs/${detail.reference.id}`}>
                  {detail.reference.name}
                </Link>
                <Label style={{ marginLeft: "5px" }}>
                  {detail.index.version}
                </Label>
              </td>
            </tr>
            <IDRow id={detail.id} />
            <tr>
              <th>Mapped Reads</th>
              <td>
                {numbro(detail.read_count).format()}
                <span style={{ paddingLeft: "5px" }}>({mappedPercent})</span>
              </td>
            </tr>
            <tr>
              <th>Library Read Count</th>
              <td>{numbro(this.props.quality.count).format()}</td>
            </tr>
            <tr>
              <th>Created</th>
              <td>
                <RelativeTime time={detail.created_at} /> by {detail.user.id}
              </td>
            </tr>
          </tbody>
        </Table>

        {content}
      </div>
    );
  }
}

const mapStateToProps = state => ({
  error: get(state, "errors.GET_ANALYSIS_ERROR", null),
  detail: state.analyses.detail,
  quality: state.samples.detail.quality
});

const mapDispatchToProps = dispatch => ({
  getAnalysis: analysisId => {
    dispatch(getAnalysis(analysisId));
  },

  clearAnalysis: () => {
    dispatch(clearAnalysis());
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AnalysisDetail);
