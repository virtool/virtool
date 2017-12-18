import { LinkContainer } from "react-router-bootstrap";
import { Icon, Button } from "../../base";
import React from "react";
import PropTypes from "prop-types";

const VirusToolbar = ({ canModify, location, onChangeTerm }) => (
    <div className="toolbar">
        <div className="form-group">
            <div className="input-group">
                <span id="find-addon" className="input-group-addon">
                    <Icon name="search" />
                </span>
                <input
                    aria-describedby="find-addon"
                    className="form-control"
                    type="text"
                    placeholder="Name or abbreviation"
                    onChange={e => onChangeTerm(e.target.value)}
                />
            </div>
        </div>

        <LinkContainer to="/viruses/indexes">
            <Button
                icon="filing"
                tip="Indexes"
            />
        </LinkContainer>

        {canModify ? (
            <LinkContainer to={{location, state: {createVirus: true}}} replace>
                <Button bsStyle="primary" tip="Create">
                    <Icon name="new-entry" />
                </Button>
            </LinkContainer>
        ) : null}
    </div>
);

VirusToolbar.propTypes = {
    canModify: PropTypes.bool,
    location: PropTypes.object,
    onChangeTerm: PropTypes.func
};

export default VirusToolbar;
