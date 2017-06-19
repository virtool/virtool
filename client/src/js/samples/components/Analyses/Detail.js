import React from "react";
import Numeral from "numeral";
import { connect } from "react-redux";
import { Label, Table } from "react-bootstrap";
import { Icon, Button, RelativeTime } from "virtool/js/components/Base";

import { getAnalysis } from "../../actions";
import { getTaskDisplayName } from "../../../utils";
import PathoscopeViewer from "./Pathoscope/Viewer";
import NuVsViewer from "./NuVs/Viewer";

class AnalysisDetail extends React.Component {

    static propTypes = {
        name: React.PropTypes.string,
        algorithm: React.PropTypes.string,
        timestamp: React.PropTypes.string,
        username: React.PropTypes.string,
        readCount: React.PropTypes.number
    };

    componentDidMount () {
        this.props.getAnalysis(this.props.match.params.analysisId);
    }

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        const detail = this.props.detail;

        let content;

        if (detail.algorithm === "pathoscope_bowtie") {
            content = <PathoscopeViewer {...detail}/>;
        }

        if (detail.algorithm === "nuvs") {
            content = <NuVsViewer {...detail} />;
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
                            <td><Label>{detail.index_version}</Label></td>
                        </tr>
                        <tr>
                            <th>Library Read Count</th>
                            <td>{Numeral(detail.read_count).format()}</td>
                        </tr>
                        <tr>
                            <th>Added</th>
                            <td><RelativeTime time={detail.timestamp} /></td>
                        </tr>
                        <tr>
                            <th>User</th>
                            <td>{detail.user_id}</td>
                        </tr>
                    </tbody>
                </Table>

                {content}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        detail: state.samples.analysisDetail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getAnalysis: (analysisId) => {
            dispatch(getAnalysis(analysisId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(AnalysisDetail);

export default Container;
