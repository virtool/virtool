import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { find } from "lodash-es";
import { RelativeTime, ProgressBar } from "../../base";
import { Panel, Table, Row, ListGroup } from "react-bootstrap";

const ReferenceHeader = ({ name, createdAt, user }) => (
    <div style={{ marginLeft: "5px" }}>
        <Row>
            <strong>{name}</strong>
        </Row>
        <Row>
            <small>
                Created <RelativeTime time={createdAt} /> by {user}
            </small>
        </Row>
    </div>
);

const ReferenceMetadata = ({ data_type, organism }) => (
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
        </tbody>
    </Table>
);

const ReferenceItem = (props) => {

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
        <Panel className="reference-item" onClick={props.onClick}>
            <Panel.Heading>
                <ReferenceHeader name={props.name} createdAt={props.created_at} user={props.user.id} />
            </Panel.Heading>

            <ReferenceMetadata {...props} />
            <Panel.Body style={{padding: 0, textAlign: "center"}}>
                <span style={{visibility: `${progress !== 100 ? "visible" : "hidden"}`, fontSize: "small"}}>
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
    onClick: () => {
        dispatch(push(`/refs/${ownProps.id}`));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceItem);
