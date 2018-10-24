import React from "react";
import { Alert as BsAlert } from "react-bootstrap";

import { Flex, FlexItem } from "./Flex";
import { Icon } from "./Icon";

export const Alert = ({ bsStyle, children, className, icon }) => {
  let content;

  if (icon) {
    content = (
      <Flex alignItems="center">
        <FlexItem>
          <Icon name={icon} />
        </FlexItem>
        <FlexItem pad={5}>{children}</FlexItem>
      </Flex>
    );
  }

  return (
    <BsAlert bsStyle={bsStyle} className={className}>
      {content || children}
    </BsAlert>
  );
};
