import React from "react";
import Marked from "marked";
import { map, sortBy } from "lodash-es";
import { Badge, ListGroup, Panel, Table, Well, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import {
    Flex,
    FlexItem,
    Icon,
    ListGroupItem,
    LoadingPlaceholder,
    NoneFound,
    RelativeTime,
    Button,
    Loader
} from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { checkUpdates, updateRemoteReference } from "../../actions";
import RemoveReference from "./RemoveReference";

const Contributors = ({ contributors }) => {
    if (contributors.length) {
        const sorted = sortBy(contributors, ["id", "count"]);

        const contributorComponents = map(sorted, entry => (
            <ListGroupItem key={entry.id}>
                {entry.id} <Badge>{entry.count}</Badge>
            </ListGroupItem>
        ));

        return <ListGroup>{contributorComponents}</ListGroup>;
    }

    return <NoneFound noun="contributors" />;
};

const LatestBuild = ({ id, latestBuild }) => {
    if (latestBuild) {
        return (
            <ListGroupItem>
                <strong>
                    <Link to={`/refs/${id}/indexes/${latestBuild.id}`}>Index {latestBuild.version}</Link>
                </strong>
                <span>
                    &nbsp;/ Created <RelativeTime time={latestBuild.created_at} /> by {latestBuild.user.id}
                </span>
            </ListGroupItem>
        );
    }

    return <NoneFound noun="builds" noListGroup />;
};

const Release = ({ release, isPending, isUpdating, onCheckUpdates, onInstall }) => {
    let updateStats;

    if (release.newer) {
        updateStats = (
            <span>
                {" "}
                / {release.name} / Published <RelativeTime time={release.published_at} />
            </span>
        );
    }

    let checker;

    if (isPending) {
        checker = <Loader size="14px" />;
    } else {
        checker = <Icon name="sync" tip="Check for Updates" tipPlacement="left" onClick={onCheckUpdates} />;
    }

    return (
        <ListGroupItem>
            <div>
                <span className={release.newer ? "text-primary" : "text-success"}>
                    <Icon name={release.newer ? "arrow-alt-circle-up" : "check"} />
                    <strong>
                        &nbsp;
                        {release.newer ? "Update Available" : "Up-to-date"}
                    </strong>
                </span>
                {updateStats}
                <Flex alignItems="center" className="pull-right">
                    <span className="text-muted">
                        Last checked <RelativeTime time={release.retrieved_at} />
                    </span>
                    <FlexItem pad={5}>{checker}</FlexItem>
                </Flex>
            </div>

            {release.newer ? (
                <Row style={{ margin: "0", paddingTop: "1rem" }}>
                    <Button
                        icon={isUpdating ? null : "download"}
                        bsStyle="primary"
                        onClick={onInstall}
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <div>
                                <Loader size="14px" /> Installing
                            </div>
                        ) : (
                            "Install"
                        )}
                    </Button>
                </Row>
            ) : null}
        </ListGroupItem>
    );
};

const Remote = ({ installed, release, slug, onCheckUpdates, onInstall, isPending, isUpdating }) => (
    <Panel>
        <Panel.Heading>
            <Flex>
                <FlexItem grow={1}>Remote Reference</FlexItem>
                <FlexItem>
                    <a href={`https://github.com/${slug}`} target="_blank" rel="noopener noreferrer">
                        <Icon faStyle="fab" name="github" /> {slug}
                    </a>
                </FlexItem>
            </Flex>
        </Panel.Heading>
        <ListGroup>
            {installed ? (
                <ListGroupItem>
                    <Icon name="hdd" /> <strong>Installed Version</strong>
                    <span> / {installed.name}</span>
                    <span>
                        {" "}
                        / Published <RelativeTime time={installed.published_at} />
                    </span>
                </ListGroupItem>
            ) : null}
            {isUpdating ? null : (
                <Release
                    release={release}
                    onCheckUpdates={onCheckUpdates}
                    isPending={isPending}
                    onInstall={onInstall}
                    isUpdating={isUpdating}
                />
            )}
        </ListGroup>
    </Panel>
);

const Clone = ({ source }) => (
    <Panel>
        <Panel.Heading>Clone Reference</Panel.Heading>
        <ListGroup>
            <ListGroupItem>
                <strong>Source Reference</strong>
                <span>
                    {" / "}
                    <a href={`/refs/${source.id}`}>{source.name}</a>
                </span>
            </ListGroupItem>
        </ListGroup>
    </Panel>
);

class ReferenceManage extends React.Component {
    handleCheckUpdates = () => {
        this.props.onCheckUpdates(this.props.detail.id);
    };

    handleUpdateRemote = () => {
        this.props.onUpdate(this.props.detail.id);
    };

    render() {
        const {
            id,
            checkPending,
            cloned_from,
            contributors,
            data_type,
            description,
            installed,
            internal_control,
            latest_build,
            organism,
            release,
            remotes_from
        } = this.props.detail;

        let remote;
        let clone;

        if (remotes_from) {
            remote = (
                <Remote
                    installed={installed}
                    release={release}
                    slug={remotes_from.slug}
                    onCheckUpdates={this.handleCheckUpdates}
                    isPending={checkPending}
                    onInstall={this.handleUpdateRemote}
                    isUpdating={this.props.isUpdating}
                />
            );
        }

        if (cloned_from) {
            clone = <Clone source={cloned_from} />;
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
                {clone}

                <Panel>
                    <Panel.Heading>Latest Index Build</Panel.Heading>

                    <ListGroup>
                        <LatestBuild refId={id} latestBuild={latest_build} />
                    </ListGroup>
                </Panel>

                <Panel>
                    <Panel.Heading>Contributors</Panel.Heading>

                    <Contributors contributors={contributors} />
                </Panel>

                {this.props.canRemove ? <RemoveReference /> : null}
            </div>
        );
    }
}

const mapStateToProps = state => ({
    detail: state.references.detail,
    canRemove: checkRefRight(state, "remove")
});

const mapDispatchToProps = dispatch => ({
    onCheckUpdates: refId => {
        dispatch(checkUpdates(refId));
    },

    onUpdate: refId => {
        dispatch(updateRemoteReference(refId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceManage);
