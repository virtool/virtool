import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    Button,
    Flex,
    FlexItem,
    Icon,
    Loader,
    ProgressBar,
    RelativeTime
} from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { checkUpdates, updateRemoteReference } from "../../actions";
import { getProgress } from "../../selectors";

const ReleaseButtonContainer = styled.div`
    margin: 0;
    padding-top: 15px;
`;

const Release = ({ release, checking, updating, onCheckUpdates, onUpdate }) => {
    let button;
    let updateStats;

    if (!updating && release.newer) {
        button = (
            <ReleaseButtonContainer>
                <Button icon="download" bsStyle="primary" onClick={onUpdate} disabled={updating}>
                    Install
                </Button>
            </ReleaseButtonContainer>
        );

        updateStats = (
            <React.Fragment>
                <FlexItem pad>/ {release.name}</FlexItem>
                <FlexItem pad>
                    / Published <RelativeTime time={release.published_at} />
                </FlexItem>
            </React.Fragment>
        );
    }

    let lastChecked;

    if (release.retrieved_at) {
        lastChecked = (
            <FlexItem className="text-muted">
                Last checked <RelativeTime time={release.retrieved_at} />
            </FlexItem>
        );
    }

    return (
        <BoxGroupSection>
            <Flex alignItems="center">
                <FlexItem className={release.newer ? "text-primary" : "text-success"}>
                    <Icon name={release.newer ? "arrow-alt-circle-up" : "check"} />
                </FlexItem>
                <FlexItem className={release.newer ? "text-primary" : "text-success"} pad={5}>
                    <strong>{release.newer ? "Update Available" : "Up-to-date"}</strong>
                </FlexItem>

                {updateStats}

                <FlexItem grow={1}>
                    <Flex alignItems="center" className="pull-right">
                        {lastChecked}

                        <FlexItem pad={5}>
                            {checking ? (
                                <Loader size="14px" />
                            ) : (
                                <Icon
                                    name="sync"
                                    tip="Check for Updates"
                                    tipPlacement="left"
                                    onClick={onCheckUpdates}
                                />
                            )}
                        </FlexItem>
                    </Flex>
                </FlexItem>
            </Flex>

            {button}
        </BoxGroupSection>
    );
};

const Upgrade = ({ progress }) => (
    <BoxGroupSection>
        <Flex alignItems="center" className="text-primary">
            <Icon name="arrow-alt-circle-up" />

            <FlexItem pad>
                <strong>Updating</strong>
            </FlexItem>
        </Flex>

        <div style={{ paddingTop: "2rem" }}>
            <ProgressBar color="green" now={progress * 100} />
        </div>
    </BoxGroupSection>
);

const Remote = ({ detail, onCheckUpdates, onUpdate, checking, progress }) => {
    const { id, installed, release, remotes_from, updating } = detail;

    const slug = remotes_from.slug;

    let installedComponent;

    if (installed) {
        installedComponent = (
            <BoxGroupSection>
                <Flex alignItems="center">
                    <FlexItem>
                        <Icon name="hdd" />
                    </FlexItem>
                    <FlexItem pad={5}>
                        <strong>Installed Version</strong>
                    </FlexItem>
                    <FlexItem pad>/ {installed.name}</FlexItem>
                    <FlexItem pad>
                        / Published <RelativeTime time={installed.published_at} />
                    </FlexItem>
                </Flex>
            </BoxGroupSection>
        );
    }

    let statusComponent;

    if (updating) {
        statusComponent = <Upgrade progress={progress} />;
    } else {
        statusComponent = (
            <Release
                release={release}
                checking={checking}
                updating={updating}
                onCheckUpdates={() => onCheckUpdates(id)}
                onUpdate={() => onUpdate(id)}
            />
        );
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <Flex>
                    <FlexItem grow={1}>
                        <h2>Remote Reference</h2>
                    </FlexItem>
                    <FlexItem>
                        <a href={`https://github.com/${slug}`} target="_blank" rel="noopener noreferrer">
                            <Icon faStyle="fab" name="github" /> {slug}
                        </a>
                    </FlexItem>
                </Flex>
            </BoxGroupHeader>

            {installedComponent}
            {statusComponent}
        </BoxGroup>
    );
};

const mapStateToProps = state => ({
    detail: state.references.detail,
    checking: state.references.checking,
    canRemove: checkRefRight(state, "remove"),
    progress: getProgress(state)
});

const mapDispatchToProps = dispatch => ({
    onCheckUpdates: refId => {
        dispatch(checkUpdates(refId));
    },

    onUpdate: refId => {
        dispatch(updateRemoteReference(refId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Remote);
