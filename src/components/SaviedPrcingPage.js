import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Header, Loader, Button, Confirm, Message, Modal, Form, Dimmer } from 'semantic-ui-react';
import firebase from '../utils/firebase';
import DataTable from 'react-data-table-component';
import styled from 'styled-components';
import toast, { Toaster } from 'react-hot-toast';

const StyledContainer = styled(Container)`
  padding: 2rem;
`;

const TopControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const ActionButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const FullscreenLoader = styled(Dimmer)`
  &.ui.dimmer {
    position: fixed;
    z-index: 9999;
  }
`;

function SavedPricingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [savedPricings, setSavedPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');

  const fetchSavedPricings = useCallback(async () => {
    try {
      const snapshot = await firebase.firestore()
        .collection('pricingHistory')
        .orderBy('createdAt', 'desc')
        .get();
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toLocaleString() || '-'
      }));
      setSavedPricings(data);
    } catch (error) {
      console.error('Error fetching saved pricings:', error);
      toast.error('獲取歷史報價資料時出錯');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchSavedPricings();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchSavedPricings]);

  const handleApply = useCallback(async (item) => {
    setIsApplying(true);
    try {
      const snapshot = await firebase.firestore().collection('bom_tables').get();
      const updatedPricingData = [];
  
      // 處理每個 BOM 表
      for (const doc of snapshot.docs) {
        const bomData = doc.data();
        const currentWebsitePrice = bomData.websitePrice ? parseFloat(bomData.websitePrice) : null;
        const savedItem = item.pricingData.find(saved => saved.id === doc.id);
        const savedWebsitePrice = savedItem?.websitePrice ? parseFloat(savedItem.websitePrice) : null;
        const hasPriceChanged = currentWebsitePrice !== null && savedWebsitePrice !== null && currentWebsitePrice !== savedWebsitePrice;
  
        // 計算包含稅金的總成本
        const totalCost = await (async () => {
          let cost = 0;
          for (const item of bomData.items || []) {
            let unitCost = 0;
            if (item.isShared) {
              if (item.unitCost instanceof firebase.firestore.DocumentReference) {
                const unitCostDoc = await item.unitCost.get();
                unitCost = unitCostDoc.exists ? unitCostDoc.data().unitCost : 0;
              } else {
                unitCost = parseFloat(item.unitCost) || 0;
              }
            } else {
              unitCost = parseFloat(item.unitCost) || 0;
            }
            const quantity = parseFloat(item.quantity) || 0;
            const itemCost = quantity * unitCost;
            const tax = item.isTaxed ? itemCost * 0.05 : 0;
            cost += itemCost + tax;
          }
          return cost;
        })();

        const currentCost = totalCost;
        const savedCost = savedItem?.totalCost || null;
        const hasCostChanged = currentCost !== null && savedCost !== null && Math.abs(currentCost - savedCost) > 0.01;

  
        // 獲取分類
        let category = '未分類';
        if (bomData.category instanceof firebase.firestore.DocumentReference) {
          try {
            const categoryDoc = await bomData.category.get();
            category = categoryDoc.exists ? categoryDoc.data().name : '未分類';
          } catch (error) {
            console.error('Error fetching category:', error);
          }
        } else if (typeof bomData.category === 'string') {
          category = bomData.category;
        }
  
        // 組合數據
        const baseData = {
          id: doc.id,
          tableName: bomData.tableName || '未命名表格',
          category,
          totalCost: currentCost,
          oldTotalCost: savedCost,
          costChanged: hasCostChanged,
          websitePrice: currentWebsitePrice,
          oldWebsitePrice: savedWebsitePrice,
          websitePriceChanged: hasPriceChanged,
          logisticsCostRate: '',
          dealerPrice: '',
          specialPrice: '',
          bottomPrice: '',
          dealerMargin: '',
          specialMargin: '',
          bottomMargin: '',
          totalCostWithLogistics: totalCost.toFixed(2),
          isNewItem: !savedItem
        };
  
        if (savedItem) {
          updatedPricingData.push({
            ...baseData,
            logisticsCostRate: savedItem.logisticsCostRate || '',
            dealerPrice: savedItem.dealerPrice || '',
            specialPrice: savedItem.specialPrice || '',
            bottomPrice: savedItem.bottomPrice || '',
            dealerMargin: savedItem.dealerMargin || '',
            specialMargin: savedItem.specialMargin || '',
            bottomMargin: savedItem.bottomMargin || '',
            totalCostWithLogistics: savedItem.totalCostWithLogistics || baseData.totalCostWithLogistics
          });
        } else {
          updatedPricingData.push(baseData);
        }
      }
  
      // 排序：先按類別，再按名稱
      updatedPricingData.sort((a, b) => {
        const categoryA = (a.category || '未分類').toLowerCase();
        const categoryB = (b.category || '未分類').toLowerCase();
        const categoryCompare = categoryA.localeCompare(categoryB);
        
        if (categoryCompare === 0) {
          return (a.tableName || '').toLowerCase().localeCompare((b.tableName || '').toLowerCase());
        }
        return categoryCompare;
      });
  
      // 儲存到 localStorage
      const saveData = {
        id: item.id,
        name: item.name || '',
        note: item.note || '',
        pricingData: updatedPricingData
      };
  
      localStorage.setItem('currentPricingData', JSON.stringify(saveData));
  
      // Success message
      const newItemsCount = updatedPricingData.filter(item => item.isNewItem).length;
      const changedPricesCount = updatedPricingData.filter(item => item.websitePriceChanged).length;
      
      if (changedPricesCount > 0) {
        toast.success(`已載入報價方案，${changedPricesCount} 個商品官網價格已更新${newItemsCount > 0 ? `，包含 ${newItemsCount} 個新商品` : ''}`);
      } else if (newItemsCount > 0) {
        toast.success(`已載入報價方案，包含 ${newItemsCount} 個新商品`);
      } else {
        toast.success('已載入報價方案');
      }

      navigate('/dealer-pricing');
    } catch (error) {
      console.error('Error applying pricing scheme:', error);
      toast.error('載入報價方案時發生錯誤');
      setIsApplying(false);
    }
  }, [navigate]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await firebase.firestore()
        .collection('pricingHistory')
        .doc(itemToDelete.id)
        .delete();

      toast.success('報價方案已刪除');
      fetchSavedPricings();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      toast.error('刪除報價方案時出錯');
    }
    setConfirmOpen(false);
    setItemToDelete(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditName(item.name || '');
    setEditNote(item.note || '');
    setIsEditModalOpen(true);
  };

  const handleDelete = (item) => {
    setItemToDelete(item);
    setConfirmOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    try {
      await firebase.firestore()
        .collection('pricingHistory')
        .doc(editingItem.id)
        .update({
          name: editName.trim(),
          note: editNote.trim(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      toast.success('報價方案已更新');
      setIsEditModalOpen(false);
      fetchSavedPricings();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast.error('更新報價方案時出錯');
    }
  };

  const columns = [
    {
      name: '方案名稱',
      selector: row => row.name,
      sortable: true,
      width: '20%',
    },
    {
      name: '建立時間',
      selector: row => row.createdAt,
      sortable: true,
      width: '20%',
    },
    {
      name: '備註',
      selector: row => row.note || '-',
      sortable: true,
      width: '20%',
    },
    {
      name: '建立者',
      selector: row => row.createdBy?.displayName || row.createdBy.email,
      sortable: true,
      width: '20%',
    },
    {
      name: '操作',
      cell: row => (
        <ActionButtonGroup>
          <Button 
            size='small' 
            primary 
            onClick={() => handleApply(row)}
            disabled={isApplying}
          >
            查看
          </Button>
          <Button 
            size='small' 
            secondary 
            onClick={() => handleEdit(row)}
            disabled={isApplying}
          >
            編輯
          </Button>
          <Button 
            size='small' 
            negative 
            onClick={() => handleDelete(row)}
            disabled={isApplying}
          >
            刪除
          </Button>
        </ActionButtonGroup>
      ),
      width: '15%',
    },
  ];

  const customStyles = {
    table: {
      style: {
        backgroundColor: 'white',
      },
    },
    rows: {
      style: {
        minHeight: '60px',
      },
    },
    headRow: {
      style: {
        backgroundColor: '#f5f5f5',
        borderBottom: '2px solid #ddd',
      },
    },
  };

  if (loading) {
    return (
      <StyledContainer>
        <Loader active>載入中...</Loader>
      </StyledContainer>
    );
  }

  if (!user) {
    return (
      <StyledContainer>
        <Message error>
          <Message.Header>需要登入</Message.Header>
          <p>您需要登入才能查看此頁面。請 <Button color="red" as={Link} to="/signin">登入</Button></p>
        </Message>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <Toaster position="top-right" />
      
      <TopControls>
        <Header as="h1">經銷歷史報價管理</Header>
        <Button 
          primary 
          as={Link} 
          to="/dealer-pricing"
          disabled={isApplying}
        >
          標準報價
        </Button>
      </TopControls>

      <DataTable
        columns={columns}
        data={savedPricings}
        pagination
        paginationPerPage={10}
        customStyles={customStyles}
        striped
        highlightOnHover
        noDataComponent="目前沒有儲存的報價方案"
      />

      <Confirm
        open={confirmOpen}
        content="確定要刪除這個報價方案嗎？此操作無法復原。"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        cancelButton='取消'
        confirmButton='確定刪除'
      />

      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        size="small"
      >
        <Modal.Header>編輯報價方案</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field required>
              <label>方案名稱</label>
              <Form.Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="輸入方案名稱"
              />
            </Form.Field>
            <Form.Field>
              <label>備註</label>
              <Form.Input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="輸入備註"
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setIsEditModalOpen(false)}>
            取消
          </Button>
          <Button positive onClick={handleUpdate}>
            更新
          </Button>
        </Modal.Actions>
      </Modal>

      <FullscreenLoader active={isApplying} inverted>
        <Loader size="large">資料載入與比對中，請稍候...</Loader>
      </FullscreenLoader>
    </StyledContainer>
  );
}

export default SavedPricingPage;