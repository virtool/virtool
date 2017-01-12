import React from "react";

export const Divider = (props) => {
    if (props.children) {
        return (
            <div className="divider">
                <hr />
                <span>
                    {props.children}
                </span>
                <hr />
            </div>
        );
    }

    return <hr />;
};

Divider.propTypes = {
    children: React.PropTypes.string
};
