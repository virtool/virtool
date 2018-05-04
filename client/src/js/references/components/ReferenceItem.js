import React from "react";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { RelativeTime } from "../../base";
import { Panel, Table, Row } from "react-bootstrap";

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

const ReferenceItem = (props) => (
    <Panel className="reference-item" onClick={props.onClick}>
        <Panel.Heading>
            <ReferenceHeader name={props.name} createdAt={props.created_at} user={props.user.id} />
        </Panel.Heading>

        <ReferenceMetadata {...props} />
    </Panel>
);

const mapDispatchToProps = (dispatch, ownProps) => ({
    onClick: () => {
        dispatch(push(`/refs/${ownProps.id}`));
    }
});

export default connect(() => ({}), mapDispatchToProps)(ReferenceItem);
