import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { RelativeTime, ProgressBar, Icon } from "../../base";
import { find, get } from "lodash-es";
import { Panel, Table, Row, ListGroup } from "react-bootstrap";

const ReferenceHeader = ({ name, createdAt, user, refId }) => (
    <div style={{ marginLeft: "5px" }}>
        <Row>
            <strong>{name}</strong>
            <Link to={{state: {newReference: true, cloneReference: true, refId}}} style={{float: "right"}}>
                <Icon
                    name="clone"
                    tip="Clone"
                />
            </Link>
        </Row>
        <Row>
            <small>
                Created <RelativeTime time={createdAt} /> by {user}
            </small>
        </Row>
    </div>
);

const ReferenceMetadata = ({ data_type, organism, origin, latest_build, progress }) => {

    let buildInfo;

    if (progress === 100) {
        if (latest_build) {
            buildInfo = (
                <React.Fragment>
                    <tr>
                        <th>Latest Build</th>
                        <td>
                            Created <RelativeTime time={latest_build.created_at} /> by {latest_build.user.id}
                        </td>
                    </tr>
                    <tr>
                        <th>Index Build ID</th>
                        <td>
                            {latest_build.id}
                        </td>
                    </tr>
                    <tr>
                        <th>Index Build Version</th>
                        <td>
                            {latest_build.version}
                        </td>
                    </tr>
                </React.Fragment>
            );
        } else {
            buildInfo = (
                <tr>
                    <th>Latest Build</th>
                    <td>
                        No Build Found
                    </td>
                </tr>
            );
        }
    }

    return (
        <Table bordered>
            <tbody>
                <tr>
                    <th>Data Type</th>
                    <td className="text-capitalize">
                        {data_type}
                    </td>
                </tr>
                <tr>
                    <th>Organism</th>
                    <td className="text-capitalize">
                        {organism || "unknown"}
                    </td>
                </tr>
                <tr>
                    <th>{origin.method}</th>
                    <td>
                        {origin.fileName}
                    </td>
                </tr>
                {buildInfo}
            </tbody>
        </Table>
    );
};

const getOrigin = (props) => {
    let origin;

    if (get(props, "imported_from", null)) {
        origin = {
            method: "Imported from file",
            fileName: props.imported_from.name
        };
    } else if (get(props, "cloned_from", null)) {
        origin = {
            method: "Cloned from",
            fileName: props.cloned_from.name
        };
    } else if (get(props, "remotes_from", null)) {
        origin = {
            method: "Remote from",
            fileName: props.remotes_from.slug
        };
    } else {
        origin = {
            method: "Created",
            fileName: "No File"
        };
    }

    return origin;
};

const ReferenceItem = (props) => {

    const origin = getOrigin(props);

    let progress = 0;
    let step;

    if (props.process && props.processes.length) {
        const process = find(props.processes, ["id", props.process.id]);
        progress = process.progress;
        step = process.step;
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

            <Panel.Body style={{padding: 0, textAlign: "center"}}>
                <span style={{visibility: `${progress === 100 ? "hidden" : "visible"}`, fontSize: "small"}}>
                    {step}
                </span>
            </Panel.Body>

            <ListGroup>
                <ProgressBar
                    bsStyle={progress === 100 ? "success" : "warning"}
                    now={progress}
                    affixed
                />
            </ListGroup>
        </Panel>
    );
};

const mapStateToProps = state => ({
    processes: state.processes.documents
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onClick: (e) => {
        if (e.target.nodeName !== "I") {
            dispatch(push(`/refs/${ownProps.id}`));
        }
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceItem);
