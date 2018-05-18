import React from "react";
import { connect } from "react-redux";
import { Table, Badge, ListGroup } from "react-bootstrap";
import { map, sortBy } from "lodash-es";
import RemoveReference from "./RemoveReference";
import { RelativeTime, ListGroupItem, LoadingPlaceholder } from "../../../base";

const ContributorTable = ({ contributors }) => {

    const sorted = sortBy(contributors, ["id", "count"]);

    let components;

    if (contributors.length) {
        components = map(sorted, entry =>
            <ListGroupItem key={entry.id}>
                {entry.id} <Badge>{entry.count}</Badge>
            </ListGroupItem>
        );
    } else {
        components = (
            <ListGroupItem>
                None <Badge>0</Badge>
            </ListGroupItem>
        );
    }

    return (
        <ListGroup style={{maxHeight: 210, overflowY: "auto"}}>
            {components}
        </ListGroup>
    );
};

class ReferenceManage extends React.Component {

    render () {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const {
            contributors,
            created_at,
            data_type,
            description,
            id,
            internal_control,
            latest_build,
            name,
            organism,
            user
        } = this.props.detail;

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Name</th>
                            <td className="col-xs-8">{name}</td>
                        </tr>
                        <tr>
                            <th>ID</th>
                            <td>{id}</td>
                        </tr>
                        <tr>
                            <th>Description</th>
                            <td>{description}</td>
                        </tr>
                        <tr>
                            <th>Data Type</th>
                            <td>{data_type}</td>
                        </tr>
                        <tr>
                            <th>Organism</th>
                            <td>{organism}</td>
                        </tr>
                        <tr>
                            <th>Created</th>
                            <td><RelativeTime time={created_at} /> by {user.id}</td>
                        </tr>
                        <tr>
                            <th>Internal Control</th>
                            <td>{internal_control ? internal_control.name : null}</td>
                        </tr>
                        <tr>
                            <th>Public</th>
                            <td>{`${this.props.detail.public}`}</td>
                        </tr>
                    </tbody>
                </Table>

                <h5>
                    <strong>Latest Build</strong>
                </h5>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Version</th>
                            <td className="col-xs-8">{latest_build.version}</td>
                        </tr>
                        <tr>
                            <th>ID</th>
                            <td>{latest_build.id}</td>
                        </tr>
                        <tr>
                            <th>Created</th>
                            <td><RelativeTime time={latest_build.created_at} /> by {latest_build.user.id}</td>
                        </tr>
                    </tbody>
                </Table>

                <h5>
                    <strong>Contributors</strong>
                </h5>
                <ContributorTable contributors={contributors} />

                <RemoveReference id={id} />
            </div>
        );
    }

}

const mapStateToProps = state => ({
    detail: state.references.detail
});

export default connect(mapStateToProps)(ReferenceManage);
