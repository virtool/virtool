import React from "react";
import { get } from "lodash-es";
import Numeral from "numeral";
import { Col, Label, Panel, ProgressBar, Row, Table } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";


import { getAnalysis, clearAnalysis } from "../../actions";
import { IDRow, LoadingPlaceholder, RelativeTime, NotFound } from "../../../base";
import { getTaskDisplayName } from "../../../utils";
import PathoscopeViewer from "./Pathoscope/Viewer";
import NuVsViewer from "./NuVs/Viewer";

class AnalysisDetail extends React.Component {

    componentDidMount () {
        this.props.getAnalysis(this.props.match.params.analysisId);
    }

    componentWillUnmount () {
        this.props.clearAnalysis();
    }

    render () {

        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null) {
            return (
                <div style={{paddingTop: "130px"}}>
                    <Row>
                        <Col xs={12} md={4} mdOffset={4}>
                            <div className="progress-small">
                                <ProgressBar now={this.props.progress || 15} active />
                            </div>
                        </Col>
                    </Row>
                </div>
            );
        }

        const detail = this.props.detail;
        let content;

        if (!detail.ready) {
            content = (
                <Panel>
                    <Panel.Body>
                        <LoadingPlaceholder message="Analysis in progress" margin="1.2rem" />
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
                                <Label style={{marginLeft: "5px"}}>
                                    {detail.index.version}
                                </Label>
                            </td>
                        </tr>
                        <IDRow id={detail.id} />
                        <tr>
                            <th>Mapped Reads</th>
                            <td>{Numeral(detail.read_count).format()}</td>
                        </tr>
                        <tr>
                            <th>Library Read Count</th>
                            <td>{Numeral(this.props.quality.count).format()}</td>
                        </tr>
                        <tr>
                            <th>Created</th>
                            <td><RelativeTime time={detail.created_at} /></td>
                        </tr>
                        <tr>
                            <th>Created By</th>
                            <td>{detail.user.id}</td>
                        </tr>
                    </tbody>
                </Table>

                {content}
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    error: get(state, "errors.GET_ANALYSIS_ERROR", null),
    detail: state.analyses.detail,
    progress: state.analyses.getAnalysisProgress,
    quality: state.samples.detail.quality
});

const mapDispatchToProps = (dispatch) => ({

    getAnalysis: (analysisId) => {
        dispatch(getAnalysis(analysisId));
    },

    clearAnalysis: () => {
        dispatch(clearAnalysis());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(AnalysisDetail);
