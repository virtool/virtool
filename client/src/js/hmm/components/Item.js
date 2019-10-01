import { keys, map, reject } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { Label, LinkBox } from "../../base";

export default function HMMItem({ cluster, families, id, names }) {
    const filteredFamilies = reject(keys(families), family => family === "None");

    const labelComponents = map(filteredFamilies.slice(0, 3), (family, i) => (
        <Label key={i} spaced>
            {family}
        </Label>
    ));

    return (
        <LinkBox to={`/hmm/${id}`}>
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
        </LinkBox>
    );
}

HMMItem.propTypes = {
    cluster: PropTypes.number,
    families: PropTypes.object,
    id: PropTypes.string,
    names: PropTypes.array
};
