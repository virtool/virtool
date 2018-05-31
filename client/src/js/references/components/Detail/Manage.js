import React from "react";
import { connect } from "react-redux";
import { Table, Badge, ListGroup } from "react-bootstrap";
import { map, sortBy } from "lodash-es";
import RemoveReference from "./RemoveReference";
import { RelativeTime, ListGroupItem, LoadingPlaceholder } from "../../../base";

const Contributors = ({ contributors }) => {

    if (contributors.length) {
        const sorted = sortBy(contributors, ["id", "count"]);

        const contributorComponents = map(sorted, entry =>
            <ListGroupItem key={entry.id}>
                {entry.id} <Badge>{entry.count}</Badge>
            </ListGroupItem>
        );

        return (
            <ListGroup>
                {contributorComponents}
            </ListGroup>
        );
    }

    return <NoneFound noun="contributors" />;
};

const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <ListGroupItem>
                <strong>
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>
                        Index {latestBuild.version}
                    </Link>
                </strong>
                <span>
                    &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </span>
            </ListGroupItem>
        );
    }

    return <NoneFound noun="index builds" noListGroup />;
};
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
            id,
            contributors,
            data_type,
            description,
            internal_control,
            latest_build,
            organism,
        } = this.props.detail;


            );
        }

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-xs-4">Description</th>
                            <td className="col-xs-8">{description}</td>
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
                            <th>Internal Control</th>
                            <td>{internal_control ? internal_control.name : null}</td>
                        </tr>
                    </tbody>
                </Table>

                {remote}

                <Panel>
                    <Panel.Heading>
                        Latest Index Build
                    </Panel.Heading>

                    <ListGroup>
                        <LatestBuild refId={id} latestBuild={latest_build} />
                    </ListGroup>
                </Panel>

                <Panel>
                    <Panel.Heading>
                        Contributors
                    </Panel.Heading>

                    <Contributors contributors={contributors} />
                </Panel>

                <RemoveReference />
            </div>
        );
    }

}

const mapStateToProps = state => ({
    detail: state.references.detail
});

export default connect(mapStateToProps)(ReferenceManage);
