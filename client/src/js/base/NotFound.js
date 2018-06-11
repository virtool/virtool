import React from "react";
import { Jumbotron } from "react-bootstrap";

/**
 * A component used for 404 Not Found errors.
 */
export const NotFound = () => (
    <Jumbotron className="not-found">
        <h1 style={{margin: "0 0 10px 0"}}>
            <span className="label label-danger" style={{padding: "10px 25px"}}>
                404
            </span>
            <small style={{color: "black", paddingLeft: "15px"}}>
                <strong>
                    Page not found
                </strong>
            </small>
        </h1>
    </Jumbotron>
);
