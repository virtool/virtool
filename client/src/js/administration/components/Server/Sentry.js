import React from "react";
import { connect } from "react-redux";
import { Panel } from "react-bootstrap";
import AdministrationSection from "../Section";
import { updateSetting } from "../../actions";
import { Button, Icon, Checkbox } from "../../../base";

export const SentryFooter = () => (
    <small className="text-warning">
        <Icon name="exclamation-triangle" /> Changes to these settings will only take effect when the server is
        reloaded.
    </small>
);

export const SentryOptions = ({ enabled, onToggle }) => {
    const description = `Enable or disable Sentry error reporting.
        Error reporting allows the developers to prevent future errors.`;

    const content = (
        <Panel.Body>
            <Button
                onClick={() => {
                    onToggle(!enabled);
                }}
                block
            >
                <Checkbox checked={enabled} /> Enable
            </Button>
        </Panel.Body>
    );

    return (
        <AdministrationSection
            title="Sentry"
            description={description}
            footerComponent={<SentryFooter />}
            content={content}
        />
    );
};

const mapStateToProps = state => ({
    enabled: state.settings.data.enable_sentry
});

const mapDispatchToProps = dispatch => ({
    onToggle: value => {
        dispatch(updateSetting("enable_sentry", value));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SentryOptions);
