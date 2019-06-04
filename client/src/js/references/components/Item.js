import React from "react";
import { connect } from "react-redux";
import { push } from "connected-react-router";
import { Link } from "react-router-dom";
import { find, get } from "lodash-es";
import { Panel, Table, Row } from "react-bootstrap";
import { RelativeTime, ProgressBar, Icon } from "../../base";

export const ReferenceHeader = ({ name, createdAt, user, refId }) => (
    <div style={{ marginLeft: "5px" }}>
        <Row>
            <strong>{name}</strong>
            <Link to={{ state: { newReference: true, cloneReference: true, refId } }} style={{ float: "right" }}>
                <Icon name="clone" tip="Clone" />
            </Link>
        </Row>
        <Row>
            <small>
                Created <RelativeTime time={createdAt} /> by {user}
            </small>
        </Row>
    </div>
);

export const ReferenceMetadata = ({ id, data_type, organism, origin, latest_build, progress }) => {
    let buildInfo;
    let originData;

    if (origin.method === "Imported from") {
        originData = origin.data.name;
    } else if (origin.method === "Remotes from") {
        originData = (
            <a href={`https://www.github.com/${origin.data.slug}`} rel="noopener noreferrer" target="_blank">
                {origin.data.slug}
            </a>
        );
    } else if (origin.method === "Cloned from") {
        originData = <Link to={`/refs/${origin.data.id}`}>{origin.data.name}</Link>;
    } else {
        originData = origin.data;
    }

    if (progress === 100) {
        if (latest_build) {
            buildInfo = (
                <React.Fragment>
                    <tr>
                        <th>Latest Build</th>
                        <td>
                            <Link to={`/refs/${id}/indexes/${latest_build.id}`}>Index {latest_build.version}</Link>
                            <div className="text-muted" style={{ fontSize: "12px" }}>
                                Created <RelativeTime time={latest_build.created_at} /> by {latest_build.user.id}
                            </div>
                        </td>
                    </tr>
                </React.Fragment>
            );
        } else {
            buildInfo = (
                <tr>
                    <th>Latest Build</th>
                    <td>No Build Found</td>
                </tr>
            );
        }
    }

    return (
        <Table bordered>
            <tbody>
                <tr>
                    <th>Organism</th>
                    <td className="text-capitalize">{organism || "unknown"}</td>
                </tr>
                <tr>
                    <th>{origin.method}</th>
                    <td>{originData}</td>
                </tr>
                {buildInfo}
            </tbody>
        </Table>
    );
};

export const getOrigin = props => {
    let origin;

    if (get(props, "imported_from", null)) {
        origin = {
            method: "Imported from",
            data: props.imported_from
        };
    } else if (get(props, "cloned_from", null)) {
        origin = {
            method: "Cloned from",
            data: props.cloned_from
        };
    } else if (get(props, "remotes_from", null)) {
        origin = {
            method: "Remotes from",
            data: props.remotes_from
        };
    } else {
        origin = {
            method: "Created",
            data: "No File"
        };
    }

    return origin;
};

export const Item = props => {
    const origin = getOrigin(props);

    let progress = 0;
    let step;

    if (props.process && props.processes.length) {
        const process = find(props.processes, ["id", props.process.id]);
        progress = process ? process.progress : 1;
        step = process ? process.step : "None";
        progress *= 100;
    } else {
        step = "None";
        progress = 100;
    }

    return (
        <Panel className="card reference-item" onClick={props.onClick}>
            <Panel.Heading>
                <ReferenceHeader name={props.name} createdAt={props.created_at} user={props.user.id} refId={props.id} />
            </Panel.Heading>

            <ReferenceMetadata {...props} origin={origin} progress={progress} />

            <Panel.Body style={{ padding: 0, textAlign: "center" }}>
                <span
                    style={{
                        visibility: `${progress === 100 ? "hidden" : "visible"}`,
                        fontSize: "small"
                    }}
                >
                    {step}
                </span>
            </Panel.Body>

            <ProgressBar bsStyle={progress === 100 ? "success" : "warning"} now={progress} affixed />
        </Panel>
    );
};

const mapStateToProps = state => ({
    processes: state.processes.documents
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onClick: e => {
        if (e.target.nodeName !== "I" && e.target.nodeName !== "A") {
            dispatch(push(`/refs/${ownProps.id}`));
        }
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Item);
