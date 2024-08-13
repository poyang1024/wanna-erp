import React, { useState, useEffect } from 'react';
import firebase from '../utils/firebase';
import { Container, Header, Table, Loader } from 'semantic-ui-react';

function SavedAnalysisPage() {
  const [savedData, setSavedData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavedData = async () => {
      try {
        const snapshot = await firebase.firestore().collection('excelAnalysis').orderBy('createdAt', 'desc').get();
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate().toLocaleString()
        }));
        setSavedData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching saved data:', error);
        setLoading(false);
      }
    };

    fetchSavedData();
  }, []);

  if (loading) {
    return <Loader active>Loading...</Loader>;
  }

  return (
    <Container>
      <Header as="h1">已保存的訂單數據</Header>
      <Table celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>檔案名稱</Table.HeaderCell>
            <Table.HeaderCell>創建時間</Table.HeaderCell>
            <Table.HeaderCell>總訂單數</Table.HeaderCell>
            <Table.HeaderCell>訂單成本率</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {savedData.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>{item.fileName}</Table.Cell>
              <Table.Cell>{item.createdAt}</Table.Cell>
              <Table.Cell>{item.stats.totalOrders}</Table.Cell>
              <Table.Cell>{(item.stats.orderCostRate * 100).toFixed(2)}%</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </Container>
  );
}

export default SavedAnalysisPage;