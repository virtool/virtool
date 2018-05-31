import React from "react";
import Semver from "semver";
import Marked from "marked";
import { filter, map, replace, sortBy } from "lodash-es";
import { Badge, ListGroup, Panel, Table, Well } from "react-bootstrap";
import { connect } from "react-redux";
import { Link} from "react-router-dom";
import RemoveReference from "./RemoveReference";
import { Flex, FlexItem, Icon, ListGroupItem, LoadingPlaceholder, NoneFound, RelativeTime } from "../../../base";

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

const Release = ({ installed, lastChecked, release }) => {

    const updateAvailable = Semver.gt(Semver.coerce(release.name), Semver.coerce(installed.name));

    let updateStats;

    if (updateAvailable) {
        updateStats = (
            <span> / {release.name} / Published <RelativeTime time={release.published_at} /></span>
        );
    }

    let updateDetail;

    if (updateAvailable) {
        const html = replace(
            Marked(release.body),
            /([0-9] +)/g,
            "<a target='_blank' href='https://github.com/virtool/virtool/issues/$1'>#$1</a>"
        );

        updateDetail = (
            <Well style={{marginTop: "10px"}}>
                <div dangerouslySetInnerHTML={{__html: html}} />
            </Well>
        );
    }

    return (
        <ListGroupItem>
            <div>
                <span className={updateAvailable ? "text-primary" : "text-success"}>
                    <Icon name={updateAvailable ? "arrow-alt-circle-up" : "check"} />
                    <strong>
                        &nbsp;{updateAvailable ? "Update Available" : "Up-to-date"}
                    </strong>
                </span>
                {updateStats}
                <span className="pull-right text-muted">
                    Last checked <RelativeTime time={lastChecked} />
                </span>
            </div>

            {updateDetail}
        </ListGroupItem>
    );
};

const Remote = ({ updates, release, remotesFrom }) => {

    const ready = filter(updates, {ready: true});

    const installed = ready.pop();

    return (
        <Panel>
            <Panel.Heading>
                <Flex>
                    <FlexItem grow={1}>
                        Remote Reference
                    </FlexItem>
                    <FlexItem>
                        <a href={`https://github.com/${remotesFrom.slug}`}>
                            <Icon faStyle="fab" name="github" /> {remotesFrom.slug}
                        </a>
                    </FlexItem>
                </Flex>
            </Panel.Heading>
            <ListGroup>
                <ListGroupItem>
                    <Icon name="hdd" /> <strong>Installed Version</strong>
                    <span> / {installed.name}</span>
                    <span> / Published <RelativeTime time={installed.published_at} /></span>
                </ListGroupItem>
                <Release
                    installed={installed}
                    lastChecked={remotesFrom.last_checked}
                    release={release}
                />
            </ListGroup>
        </Panel>
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
            release,
            remotes_from,
            updates
        } = this.props.detail;

        let remote;

        if (remotes_from) {
            remote = (
                <Remote
                    release={release}
                    remotesFrom={remotes_from}
                    updates={updates}
                />
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
