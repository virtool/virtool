import React from "react";
import styled from "styled-components";
import { Col, Row } from "react-bootstrap";
import { Icon, ListGroupItem } from "../../base";

const PermissionItems = styled.div`
    display: inline-block;
    width: 22%;
    margin-left: 15px;
    margin-right: 10px;

    @media (max-width: 992px) {
        display: flex;
        flex-direction: column;
        width: 97%;
    }
`;

export const PermissionItem = ({ permission, value }) => (
    <PermissionItems>
        <ListGroupItem bsStyle={value ? "success" : "danger"}>
            <code>{permission}</code> <Icon name={value ? "check" : "times"} pullRight />
        </ListGroupItem>
    </PermissionItems>
);
