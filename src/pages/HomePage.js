import React from 'react';
import { Container, Header, Image } from 'semantic-ui-react';

function HomePage() {
  return (
    <Container 
      fluid 
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#ffffff'
      }}
    >
      <Image 
        src="https://www.owlting.com/p400/place_photo_129148"
        size='medium' 
        style={{ marginBottom: '2rem' }}
      />
      <Header 
        as='h1' 
        textAlign='center'
        style={{
          fontSize: '3rem',
          color: '#333'
        }}
      >
        歡迎來到丸那水餃 ERP 系統
      </Header>
    </Container>
  );
}

export default HomePage;