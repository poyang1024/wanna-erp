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
        src="https://www.kindfoodtw.com/media/W1siZiIsIjEzOTg4L2F0dGFjaGVkX3Bob3Rvcy8xNjgzMDI3NzYwX-acquWRveWQjS0yLnBuZy5wbmciXV0.png?sha=b4d877a6657e1424"
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
        歡迎來到 KIND FOOD 康福先生 ERP 系統
      </Header>
    </Container>
  );
}

export default HomePage;