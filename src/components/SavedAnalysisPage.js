import React, { useState, useEffect } from 'react';
import firebase from '../utils/firebase';
import { Container, Header, Table, Loader, Button, Confirm } from 'semantic-ui-react';
import toast, { Toaster } from 'react-hot-toast';

function SavedAnalysisPage() {
  const [savedData, setSavedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

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
      toast.error('獲取數據時出錯');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedData();
  }, []);

  const handleDelete = (item) => {
    setItemToDelete(item);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        await firebase.firestore().collection('excelAnalysis').doc(itemToDelete.id).delete();
        toast.success('數據已成功刪除');
        fetchSavedData(); // 重新加載數據
      } catch (error) {
        console.error('Error deleting data:', error);
        toast.error('刪除數據時出錯');
      }
    }
    setConfirmOpen(false);
    setItemToDelete(null);
  };

  if (loading) {
    return <Loader active>Loading...</Loader>;
  }

  return (
    <Container>
      <Toaster position="top-right" />
      <Header as="h1">已保存的訂單數據</Header>
      <Table celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>檔案名稱</Table.HeaderCell>
            <Table.HeaderCell>創建時間</Table.HeaderCell>
            <Table.HeaderCell>總訂單數</Table.HeaderCell>
            <Table.HeaderCell>訂單成本率</Table.HeaderCell>
            <Table.HeaderCell>操作</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {savedData.map((item) => (
            <Table.Row key={item.id}>
              <Table.Cell>{item.fileName}</Table.Cell>
              <Table.Cell>{item.createdAt}</Table.Cell>
              <Table.Cell>{item.stats.totalOrders}</Table.Cell>
              <Table.Cell>{(item.stats.orderCostRate * 100).toFixed(2)}%</Table.Cell>
              <Table.Cell>
                <Button color="red" onClick={() => handleDelete(item)}>
                  刪除
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Confirm
        open={confirmOpen}
        content="確定要刪除這筆數據嗎？"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        cancelButton='取消'
        confirmButton='確定刪除'
      />
    </Container>
  );
}

export default SavedAnalysisPage;