import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Dropdown, Message, Input, Icon, Confirm } from 'semantic-ui-react';
import firebase from '../utils/firebase';
import styled from 'styled-components';

const Container = styled.div`
  padding: 20px;
`;

const CenteredContent = styled.div`
  text-align: center;
  padding: 10px 0;
`;

const CustomCombinationAnalysis = () => {
  const [combinations, setCombinations] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentCombination, setCurrentCombination] = useState({ name: '', products: [] });
  const [categories, setCategories] = useState([]);
  const [productsByCategory, setProductsByCategory] = useState({});
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [combinationToDelete, setCombinationToDelete] = useState(null);

  useEffect(() => {
    fetchCombinations();
    fetchCategories();
  }, []);

  const calculateProductCost = useCallback((items) => {
    return items.reduce((total, item) => {
      const itemCost = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
      const tax = item.isTaxed ? itemCost * 0.05 : 0;
      return total + itemCost + tax;
    }, 0);
  }, []);

  const fetchCombinations = useCallback(async () => {
    try {
      const snapshot = await firebase.firestore().collection('custom_combinations').get();
      const combinationsData = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        const products = await Promise.all(data.products.map(async product => {
          const bomRef = firebase.firestore().doc(`bom_tables/${product.productId}`);
          const bomDoc = await bomRef.get();
          const bomData = bomDoc.data();
          let items = bomData.items;
          
          items = await Promise.all(items.map(async item => {
            if (item.isShared) {
              if (item.unitCost instanceof firebase.firestore.DocumentReference) {
                const unitCostDoc = await item.unitCost.get();
                item.unitCost = unitCostDoc.data().unitCost;
              }
              if (item.name instanceof firebase.firestore.DocumentReference) {
                const nameDoc = await item.name.get();
                item.name = nameDoc.data().name;
              }
            }
            return item;
          }));

          const cost = calculateProductCost(items) * product.quantity;
          return {
            ...product,
            name: bomData.tableName,
            cost: cost
          };
        }));
        const totalCost = products.reduce((total, product) => total + product.cost, 0);
        return {
          id: doc.id,
          ...data,
          products: products,
          totalCost: totalCost,
          updatedAt: data.updatedAt ? data.updatedAt.toDate() : null
        };
      }));
      setCombinations(combinationsData);
    } catch (error) {
      console.error("Error fetching combinations:", error);
      setError("無法獲取自定義組合。請稍後再試。");
    }
  }, [calculateProductCost]);

  const fetchCategories = async () => {
    try {
      const snapshot = await firebase.firestore().collection('categorys').get();
      const categoriesData = snapshot.docs.map(doc => ({
        key: doc.id,
        text: doc.data().name,
        value: doc.id
      }));
      setCategories(categoriesData);
      
      categoriesData.forEach(category => {
        fetchProducts(category.value);
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      setError("無法獲取類別。請稍後再試。");
    }
  };

  const fetchProducts = async (categoryId) => {
    try {
      const snapshot = await firebase.firestore().collection('bom_tables')
        .where('category', '==', firebase.firestore().doc(`categorys/${categoryId}`))
        .get();
      const productsData = snapshot.docs.map(doc => ({
        key: doc.id,
        text: doc.data().tableName,
        value: doc.id
      }));
      setProductsByCategory(prev => ({
        ...prev,
        [categoryId]: productsData
      }));
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("無法獲取產品。請稍後再試。");
    }
  };

  const handleAddProduct = () => {
    setCurrentCombination(prev => ({
      ...prev,
      products: [...prev.products, { categoryId: '', productId: '', quantity: 1 }]
    }));
  };

  const handleRemoveProduct = (index) => {
    setCurrentCombination(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleProductChange = (index, field, value) => {
    setCurrentCombination(prev => {
      const updatedProducts = [...prev.products];
      updatedProducts[index] = { ...updatedProducts[index], [field]: value };
      
      if (field === 'categoryId') {
        updatedProducts[index].productId = '';
      }
      
      return { ...prev, products: updatedProducts };
    });
  };

  const handleSaveCombination = async () => {
    if (!currentCombination.name.trim()) {
      setError("請輸入組合名稱");
      return;
    }
    if (currentCombination.products.length === 0 || currentCombination.products.some(p => !p.productId)) {
      setError("請為每個項目選擇產品");
      return;
    }

    try {
      const processedProducts = currentCombination.products.map(p => ({
        categoryId: p.categoryId,
        productId: p.productId,
        quantity: p.quantity
      }));

      const updateData = {
        name: currentCombination.name,
        products: processedProducts,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (modalMode === 'add') {
        updateData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await firebase.firestore().collection('custom_combinations').add(updateData);
      } else {
        await firebase.firestore().collection('custom_combinations').doc(currentCombination.id).update(updateData);
      }

      setIsModalOpen(false);
      setCurrentCombination({ name: '', products: [] });
      setError('');
      fetchCombinations();
    } catch (error) {
      console.error("Error saving combination:", error);
      setError("保存組合時出錯。請稍後再試。");
    }
  };

  const handleEditCombination = (combination) => {
    setModalMode('edit');
    setCurrentCombination({
      id: combination.id,
      name: combination.name,
      products: combination.products.map(p => ({
        categoryId: p.categoryId,
        productId: p.productId,
        quantity: p.quantity
      }))
    });
    setIsModalOpen(true);
  };

  const handleDeleteCombination = (combination) => {
    setCombinationToDelete(combination);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (combinationToDelete) {
      try {
        await firebase.firestore().collection('custom_combinations').doc(combinationToDelete.id).delete();
        fetchCombinations();
        setConfirmOpen(false);
        setCombinationToDelete(null);
      } catch (error) {
        console.error("Error deleting combination:", error);
        setError("刪除組合時出錯。請稍後再試。");
      }
    }
  };

  return (
    <Container>
      <h2>自定義組合分析</h2>
      {error && <Message negative>{error}</Message>}
      <Button primary onClick={() => {
        setModalMode('add');
        setCurrentCombination({ name: '', products: [] });
        setIsModalOpen(true);
      }}>
        新增自定義組合
      </Button>
      <Table celled>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>組合名稱</Table.HeaderCell>
            <Table.HeaderCell>產品</Table.HeaderCell>
            <Table.HeaderCell>總成本</Table.HeaderCell>
            <Table.HeaderCell>最後更新時間</Table.HeaderCell>
            <Table.HeaderCell>操作</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {combinations.map(combination => (
            <Table.Row key={combination.id}>
              <Table.Cell>{combination.name}</Table.Cell>
              <Table.Cell>
                {combination.products.map((product, index) => (
                  <div key={index}>
                    {product.name} (x{product.quantity}) - ${product.cost.toFixed(2)}
                  </div>
                ))}
              </Table.Cell>
              <Table.Cell>${combination.totalCost.toFixed(2)}</Table.Cell>
              <Table.Cell>
                {combination.updatedAt 
                  ? combination.updatedAt.toLocaleString('zh-TW', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })
                  : '尚未更新'}
              </Table.Cell>
              <Table.Cell>
                <Button icon onClick={() => handleEditCombination(combination)}>
                  <Icon name="edit" />
                </Button>
                <Button icon negative onClick={() => handleDeleteCombination(combination)}>
                  <Icon name="trash" />
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Modal.Header>{modalMode === 'add' ? '新增自定義組合' : '編輯自定義組合'}</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Input
              label="組合名稱"
              value={currentCombination.name}
              onChange={(e, { value }) => setCurrentCombination(prev => ({ ...prev, name: value }))}
            />
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>類別</Table.HeaderCell>
                  <Table.HeaderCell>產品</Table.HeaderCell>
                  <Table.HeaderCell>數量</Table.HeaderCell>
                  <Table.HeaderCell>操作</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {currentCombination.products.map((product, index) => (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <Dropdown
                        placeholder='選擇類別'
                        fluid
                        selection
                        options={categories}
                        value={product.categoryId}
                        onChange={(e, { value }) => handleProductChange(index, 'categoryId', value)}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Dropdown
                        placeholder='選擇產品'
                        fluid
                        selection
                        options={productsByCategory[product.categoryId] || []}
                        value={product.productId}
                        onChange={(e, { value }) => handleProductChange(index, 'productId', value)}
                        disabled={!product.categoryId}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Input
                        type="number"
                        value={product.quantity}
                        onChange={(e, { value }) => handleProductChange(index, 'quantity', parseFloat(value) || 1)}
                        min="1"
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Button negative icon onClick={() => handleRemoveProduct(index)}>
                        <Icon name="trash" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            <Button positive onClick={handleAddProduct}>新增產品</Button>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setIsModalOpen(false)}>取消</Button>
          <Button positive onClick={handleSaveCombination}>
            {modalMode === 'add' ? '保存組合' : '更新組合'}
          </Button>
        </Modal.Actions>
      </Modal>

      <Confirm
        open={confirmOpen}
        onCancel={() => {
          setConfirmOpen(false);
          setCombinationToDelete(null);
        }}
        onConfirm={confirmDelete}
        content={
          <CenteredContent>
            <p>
              確定要刪除組合 <span style={{ color: 'red', fontWeight: 'bold' }}>{combinationToDelete?.name}</span> 嗎？
            </p>
          </CenteredContent>
        }
        header="刪除確認"
        cancelButton="取消"
        confirmButton="確定刪除"
        size="tiny"
      />
    </Container>
  );
};

export default CustomCombinationAnalysis;