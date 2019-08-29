import React from "react";
import PropTypes from "prop-types";
import { LinkContainer } from "react-router-bootstrap";
import { keys, map, reject } from "lodash-es";
import { Col, Row } from "react-bootstrap";

import { Label, ListGroupItem } from "../../base";

export default function HMMItem({ cluster, families, id, names }) {
    const filteredFamilies = reject(keys(families), family => family === "None");

    const labelComponents = map(filteredFamilies.slice(0, 3), (family, i) => (
        <Label key={i} spaced>
            {family}
        </Label>
    ));

    return (
        <LinkContainer to={`/hmm/${id}`}>
            <ListGroupItem className="spaced">
                <Row>
                    <Col xs={2}>
                        <strong>{cluster}</strong>
                    </Col>
                    <Col xs={5}>{names[0]}</Col>
                    <Col xs={5}>
                        <div className="pull-right">
                            {labelComponents} {filteredFamilies.length > 3 ? "..." : null}
                        </div>
                    </Col>
                </Row>
            </ListGroupItem>
        </LinkContainer>
    );
}

HMMItem.propTypes = {
    cluster: PropTypes.number,
    families: PropTypes.object,
    id: PropTypes.string,
    names: PropTypes.array
};
