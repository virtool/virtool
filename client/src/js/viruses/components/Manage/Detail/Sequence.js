/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { LinkContainer} from "react-router-bootstrap";
import { Row, Col, ListGroup, FormGroup, FormControl, ControlLabel } from "react-bootstrap";
import { ListGroupItem, Input } from "virtool/js/components/Base";
import SequenceField from "./SequenceField";


const Sequence = (props) => {

    const accession = props.accession;

    console.log(props);

    const item = (
        <ListGroupItem key={accession}>
            {accession} - {props.definition}

            <form>
                <Row>
                    <Col md={6}>
                        <FormGroup>
                            <ControlLabel>Accession</ControlLabel>
                            <FormControl
                                type="text"
                                name="sequenceId"
                                value={props.accession}
                                readOnly
                            />
                        </FormGroup>
                    </Col>
                    <Col md={6}>
                        <Input
                            type="text"
                            name="host"
                            label="Host"
                            value={props.host}
                            placeholder={false ? "eg. Ageratum conyzoides" : ""}
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <Input
                            type="text"
                            name="definition"
                            label="Definition"
                            value={props.definition}
                            placeholder="eg. Ageratum enation virus, complete genome"
                        />
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <SequenceField
                            sequence={props.sequence}
                        />
                    </Col>
                </Row>
            </form>
        </ListGroupItem>
    );

    if (!props.active) {
        return item;
    }

    return (
        <LinkContainer key={accession} to={props.accession}>
            {item}
        </LinkContainer>
    );
};

export default Sequence;
