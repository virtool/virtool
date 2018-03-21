import React from "react";
import Numeral from "numeral";
import { connect } from "react-redux";
import { Col, Label, Panel, ProgressBar, Row, Table } from "react-bootstrap";
import {IDRow, LoadingPlaceholder, RelativeTime} from "../../../base";

import { getAnalysis } from "../../actions";
import { getTaskDisplayName } from "../../../utils";
import PathoscopeViewer from "./Pathoscope/Viewer";
import NuVsViewer from "./NuVs/Viewer";

class AnalysisDetail extends React.Component {

    componentDidMount () {
        this.props.getAnalysis(this.props.match.params.analysisId);
    }

    render () {

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
                    <LoadingPlaceholder message="Analysis in progress" margin="1.2rem" />
                </Panel>
            );
        }

        else if (detail.algorithm === "pathoscope_bowtie") {
            content = (
                <PathoscopeViewer
                    {...detail}
                    maxReadLength={this.props.quality.length[1]}
                />
            );
        }

        else if (detail.algorithm === "nuvs") {
            content = (
                <NuVsViewer
                    history={this.props.history}
                    location={this.props.location}
                    {...detail}
                />
            );
        }

        else {
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
                            <th>Index Version</th>
                            <td><Label>{detail.index.version}</Label></td>
                        </tr>
                        <IDRow id={detail.id} />
                        <tr>
                            <th>Library Read Count</th>
                            <td>{Numeral(detail.read_count).format()}</td>
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
    detail: state.samples.analysisDetail,
    progress: state.samples.getAnalysisProgress,
    quality: state.samples.detail.quality
});

const mapDispatchToProps = (dispatch) => ({

    getAnalysis: (analysisId) => {
        dispatch(getAnalysis(analysisId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysisDetail);

export default Container;
