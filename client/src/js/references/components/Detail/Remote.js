import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    AffixedProgressBar,
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    Button,
    Flex,
    FlexItem,
    Icon,
    Loader,
    RelativeTime
} from "../../../base";
import { checkUpdates, updateRemoteReference } from "../../actions";
import { checkReferenceRight, getProgress } from "../../selectors";

const ReleaseButtonContainer = styled.div`
    margin: 0;
    padding-top: 15px;
`;

const ReleaseHeader = styled.div`
    align-items: center;
    display: flex;

    > i,
    > strong {
        color: ${props => props.theme.color[props.newer ? "blue" : "greenDark"]};
    }

    > strong {
        margin-left: 5px;
    }
`;

const ReleaseLastChecked = styled.span`
    align-items: center;
    display: flex;
    margin-left: auto;

    span {
        padding-right: 3px;
    }
`;

const StyledRelease = styled(BoxGroupSection)``;

const Release = ({ release, checking, updating, onCheckUpdates, onUpdate }) => {
    let button;
    let updateStats;

    if (!updating && release.newer) {
        button = (
            <ReleaseButtonContainer>
                <Button icon="download" color="blue" onClick={onUpdate} disabled={updating}>
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
            <span>
                Last checked <RelativeTime time={release.retrieved_at} />
            </span>
        );
    }

    return (
        <StyledRelease newer={release.newer}>
            <ReleaseHeader>
                <Icon name={release.newer ? "arrow-alt-circle-up" : "check"} />
                <strong>{release.newer ? "Update Available" : "Up-to-date"}</strong>

                {updateStats}

                <ReleaseLastChecked>
                    {lastChecked}
                    {checking ? <Loader size="14px" /> : <Icon name="sync" onClick={onCheckUpdates} />}
                </ReleaseLastChecked>
            </ReleaseHeader>

            {button}
        </StyledRelease>
    );
};

const StyledUpgrade = styled(BoxGroupSection)`
    align-items: center;
    color: ${props => props.theme.color.blue};
    display: flex;

    strong {
        margin-left: 3px;
    }
`;

const Upgrade = ({ progress }) => (
    <StyledUpgrade>
        <AffixedProgressBar color="green" now={progress} />
        <Icon name="arrow-alt-circle-up" />
        <strong>Updating</strong>
    </StyledUpgrade>
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
    canRemove: checkReferenceRight(state, "remove"),
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
