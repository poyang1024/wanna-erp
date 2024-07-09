import React from 'react';
import { Container, Segment } from 'semantic-ui-react';

function Footer() {
  return (
    <Segment inverted vertical style={{ padding: '2em 0em', marginTop: '2em' }}>
      <Container textAlign='center'>
        Copyright ©{new Date().getFullYear()} KindFoodtw All rights reserved.
      </Container>
    </Segment>
  );
}

export default Footer;