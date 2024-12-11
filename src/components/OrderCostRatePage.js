import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Header, Loader, Button, Modal, Form, Message, Table, Checkbox } from 'semantic-ui-react';
import firebase from '../utils/firebase';
import DataTable from 'react-data-table-component';
import styled from 'styled-components';
import toast, { Toaster } from 'react-hot-toast';

// Styled Components
const StyledContainer = styled(Container)`
  padding: 2rem;
`;

const TopControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const CalculationTable = styled(Table)`
  &.ui.table {
    margin-top: 2rem;
  }
  
  input {
    width: 100%;
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .checkbox {
    margin-left: 1rem;
  }
`;

const ActionButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

function OrderCostRatePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [costRateHistory, setCostRateHistory] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // 計算相關的狀態
  const [calculationData, setCalculationData] = useState({
    name: '',
    note: '',
    averageOrderValue: '',
    warehouseLogistics: '',
    cardboardBox: '',
    creditCardFee: '',
    otherCosts: [],
    taxInclusions: {
      averageOrderValue: true,
      warehouseLogistics: false,
      cardboardBox: false,
      creditCardFee: false
    }
  });

  // 重置表單
  const resetForm = () => {
    setCalculationData({
      name: '',
      note: '',
      averageOrderValue: '',
      warehouseLogistics: '',
      cardboardBox: '',
      creditCardFee: '',
      otherCosts: [],
      taxInclusions: {
        averageOrderValue: true,
        warehouseLogistics: false,
        cardboardBox: false,
        creditCardFee: false
      }
    });
  };

  // 驗證使用者登入狀態
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchCostRateHistory();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 取得歷史記錄
  const fetchCostRateHistory = async () => {
    try {
      const snapshot = await firebase.firestore()
        .collection('costRateHistory')
        .orderBy('createdAt', 'desc')
        .get();
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toLocaleString() || '-'
      }));
      
      setCostRateHistory(data);
    } catch (error) {
      console.error('Error fetching cost rate history:', error);
      toast.error('獲取歷史記錄時出錯');
    } finally {
      setLoading(false);
    }
  };

  // 計算總成本和成本率
  const calculateTotals = useCallback(() => {
    const averageOrderValue = parseFloat(calculationData.averageOrderValue) || 0;
    const warehouseLogistics = parseFloat(calculationData.warehouseLogistics) || 0;
    const cardboardBox = parseFloat(calculationData.cardboardBox) || 0;
    const creditCardFee = parseFloat(calculationData.creditCardFee) || 0;

    // 計算平均客單價的稅金
    const avgOrderTax = calculationData.taxInclusions.averageOrderValue ? 
                       averageOrderValue * 0.05 : 0;

    // 計算其他項目的稅金（要扣除的部分）
    const otherTaxes = {
      warehouseLogistics: calculationData.taxInclusions.warehouseLogistics ? 
                         warehouseLogistics * 0.05 : 0,
      cardboardBox: calculationData.taxInclusions.cardboardBox ? 
                   cardboardBox * 0.05 : 0,
      creditCardFee: calculationData.taxInclusions.creditCardFee ? 
                    creditCardFee * 0.05 : 0,
    };

    // 計算其他成本項目的總額和稅金
    const otherCostsTotalAndTax = calculationData.otherCosts.reduce((acc, cost) => {
      const amount = parseFloat(cost.amount) || 0;
      const tax = cost.includeTax ? amount * 0.05 : 0;
      return {
        total: acc.total + amount,
        tax: acc.tax + tax
      };
    }, { total: 0, tax: 0 });

    // 計算其他項目的成本總和（不含稅）
    const otherCosts = warehouseLogistics + cardboardBox + creditCardFee + 
                      otherCostsTotalAndTax.total;

    // 計算所有其他項目的稅金總和（要扣除）
    const totalOtherTaxes = Object.values(otherTaxes).reduce((sum, tax) => sum + tax, 0) + 
                           otherCostsTotalAndTax.tax;

    // 計算最終成本 TTL = 平均客單價稅金 + 其他成本 - 其他稅金
    const totalCost = avgOrderTax + otherCosts - totalOtherTaxes;

    // 計算成本率
    const costRate = averageOrderValue ? (totalCost / averageOrderValue) * 100 : 0;

    return {
      totalCost: totalCost.toFixed(2),
      costRate: costRate.toFixed(2),
      taxes: {
        ...otherTaxes,
        averageOrderValue: avgOrderTax
      }
    };
  }, [calculationData]);

  // 處理輸入變更
  const handleInputChange = (field, value) => {
    setCalculationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

// 處理稅金選項變更
const handleTaxChange = (field) => {
    setCalculationData(prev => ({
      ...prev,
      taxInclusions: {
        ...prev.taxInclusions,
        [field]: !prev.taxInclusions[field]
      }
    }));
  };

  // 新增其他成本項目
  const addOtherCost = () => {
    setCalculationData(prev => ({
      ...prev,
      otherCosts: [...prev.otherCosts, { name: '', amount: '', includeTax: false }]
    }));
  };

  // 更新其他成本項目
  const updateOtherCost = (index, field, value) => {
    setCalculationData(prev => {
      const newOtherCosts = [...prev.otherCosts];
      if (field === 'includeTax') {
        newOtherCosts[index] = {
          ...newOtherCosts[index],
          includeTax: !newOtherCosts[index].includeTax
        };
      } else {
        newOtherCosts[index] = {
          ...newOtherCosts[index],
          [field]: value
        };
      }
      return {
        ...prev,
        otherCosts: newOtherCosts
      };
    });
  };

  // 移除其他成本項目
  const removeOtherCost = (index) => {
    setCalculationData(prev => ({
      ...prev,
      otherCosts: prev.otherCosts.filter((_, i) => i !== index)
    }));
  };

  // 處理編輯
  const handleEdit = (row) => {
    setCalculationData({
      name: row.name,
      note: row.note || '',
      averageOrderValue: row.averageOrderValue || '',
      warehouseLogistics: row.warehouseLogistics || '',
      cardboardBox: row.cardboardBox || '',
      creditCardFee: row.creditCardFee || '',
      otherCosts: row.otherCosts || [],
      taxInclusions: row.taxInclusions || {
        averageOrderValue: true,
        warehouseLogistics: false,
        cardboardBox: false,
        creditCardFee: false
      }
    });
    setEditingId(row.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  // 處理刪除
  const handleDelete = (row) => {
    setItemToDelete(row);
    setShowDeleteConfirm(true);
  };

  // 確認刪除
  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await firebase.firestore()
        .collection('costRateHistory')
        .doc(itemToDelete.id)
        .delete();

      toast.success('成本率計算已刪除');
      fetchCostRateHistory();
    } catch (error) {
      console.error('Error deleting cost rate:', error);
      toast.error('刪除成本率時出錯');
    } finally {
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  // 保存新資料
  const handleSave = async () => {
    if (!calculationData.name.trim()) {
      toast.error('請輸入方案名稱');
      return;
    }

    if (!calculationData.averageOrderValue) {
      toast.error('請輸入平均客單價');
      return;
    }

    try {
      const { totalCost, costRate, taxes } = calculateTotals();
      
      await firebase.firestore().collection('costRateHistory').add({
        ...calculationData,
        totalCost,
        costRate,
        taxes,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email
        }
      });

      toast.success('成本率計算已保存');
      setIsModalOpen(false);
      resetForm();
      fetchCostRateHistory();
    } catch (error) {
      console.error('Error saving cost rate:', error);
      toast.error('保存成本率時出錯');
    }
  };

  // 更新現有資料
  const handleUpdate = async () => {
    if (!calculationData.name.trim()) {
      toast.error('請輸入方案名稱');
      return;
    }

    if (!calculationData.averageOrderValue) {
      toast.error('請輸入平均客單價');
      return;
    }

    try {
      const { totalCost, costRate, taxes } = calculateTotals();
      
      await firebase.firestore()
        .collection('costRateHistory')
        .doc(editingId)
        .update({
          ...calculationData,
          totalCost,
          costRate,
          taxes,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email
          }
        });

      toast.success('成本率計算已更新');
      setIsModalOpen(false);
      setIsEditMode(false);
      setEditingId(null);
      resetForm();
      fetchCostRateHistory();
    } catch (error) {
      console.error('Error updating cost rate:', error);
      toast.error('更新成本率時出錯');
    }
  };
  // 表格欄位設定
  const columns = [
    {
      name: '方案名稱',
      selector: row => row.name,
      sortable: true,
      width: '20%',
    },
    {
      name: '平均客單價',
      selector: row => row.averageOrderValue,
      sortable: true,
      format: row => `$${parseFloat(row.averageOrderValue).toFixed(2)}`,
      width: '15%',
    },
    {
      name: '成本 TTL',
      selector: row => row.totalCost,
      sortable: true,
      format: row => `$${row.totalCost}`,
      width: '15%',
    },
    {
      name: '成本率',
      selector: row => row.costRate,
      sortable: true,
      format: row => `${row.costRate}%`,
      width: '15%',
    },
    {
      name: '建立時間',
      selector: row => row.createdAt,
      sortable: true,
      width: '20%',
    },
    {
      name: '操作',
      cell: row => (
        <ActionButtonGroup>
          <Button 
            size='small' 
            color='blue'
            onClick={() => handleEdit(row)}
          >
            修改
          </Button>
          <Button 
            size='small' 
            negative
            onClick={() => handleDelete(row)}
          >
            刪除
          </Button>
        </ActionButtonGroup>
      ),
      width: '15%',
    }
  ];

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

  const totals = calculateTotals();

  return (
    <StyledContainer>
      <Toaster position="top-right" />
      
      <TopControls>
        <Header as="h1">訂單成本率管理</Header>
        <Button 
          primary
          onClick={() => {
            setIsEditMode(false);
            setEditingId(null);
            resetForm();
            setIsModalOpen(true);
          }}
        >
          新增成本率計算
        </Button>
      </TopControls>

      <DataTable
        columns={columns}
        data={costRateHistory}
        pagination
        paginationPerPage={10}
        striped
        highlightOnHover
        noDataComponent="目前沒有儲存的成本率計算"
      />

      {/* 計算 Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsEditMode(false);
          setEditingId(null);
          resetForm();
        }}
        size="large"
      >
        <Modal.Header>{isEditMode ? '修改成本率計算' : '新增成本率計算'}</Modal.Header>
        <Modal.Content scrolling>
          <Form>
            <Form.Field required>
              <label>方案名稱</label>
              <Form.Input
                value={calculationData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="輸入方案名稱"
              />
            </Form.Field>
            <Form.Field>
              <label>備註</label>
              <Form.Input
                value={calculationData.note}
                onChange={(e) => handleInputChange('note', e.target.value)}
                placeholder="輸入備註"
              />
            </Form.Field>

            <CalculationTable celled>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>項目</Table.HeaderCell>
                  <Table.HeaderCell>金額</Table.HeaderCell>
                  <Table.HeaderCell>含稅</Table.HeaderCell>
                  <Table.HeaderCell>稅金 (5%)</Table.HeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                <Table.Row>
                  <Table.Cell>免運門檻=平均客單價</Table.Cell>
                  <Table.Cell>
                    <input
                      type="number"
                      value={calculationData.averageOrderValue}
                      onChange={(e) => handleInputChange('averageOrderValue', e.target.value)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Checkbox
                      checked={calculationData.taxInclusions.averageOrderValue}
                      onChange={() => handleTaxChange('averageOrderValue')}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {totals.taxes.averageOrderValue.toFixed(2)}
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>倉儲+物流</Table.Cell>
                  <Table.Cell>
                    <input
                      type="number"
                      value={calculationData.warehouseLogistics}
                      onChange={(e) => handleInputChange('warehouseLogistics', e.target.value)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Checkbox
                      checked={calculationData.taxInclusions.warehouseLogistics}
                      onChange={() => handleTaxChange('warehouseLogistics')}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {totals.taxes.warehouseLogistics.toFixed(2)}
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>紙箱</Table.Cell>
                  <Table.Cell>
                    <input
                      type="number"
                      value={calculationData.cardboardBox}
                      onChange={(e) => handleInputChange('cardboardBox', e.target.value)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Checkbox
                      checked={calculationData.taxInclusions.cardboardBox}
                      onChange={() => handleTaxChange('cardboardBox')}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {totals.taxes.cardboardBox.toFixed(2)}
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.Cell>信用卡手續費</Table.Cell>
                  <Table.Cell>
                    <input
                      type="number"
                      value={calculationData.creditCardFee}
                      onChange={(e) => handleInputChange('creditCardFee', e.target.value)}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <Checkbox
                      checked={calculationData.taxInclusions.creditCardFee}
                      onChange={() => handleTaxChange('creditCardFee')}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    {totals.taxes.creditCardFee.toFixed(2)}
                  </Table.Cell>
                </Table.Row>

                {calculationData.otherCosts.map((cost, index) => (
                  <Table.Row key={index}>
                    <Table.Cell>
                      <input
                        type="text"
                        value={cost.name}
                        onChange={(e) => updateOtherCost(index, 'name', e.target.value)}
                        placeholder="其他成本項目名稱"
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <input
                        type="number"
                        value={cost.amount}
                        onChange={(e) => updateOtherCost(index, 'amount', e.target.value)}
                        placeholder="金額"
                      />
                    </Table.Cell>
                    <Table.Cell>
                      <Checkbox
                        checked={cost.includeTax}
                        onChange={() => updateOtherCost(index, 'includeTax')}
                      />
                    </Table.Cell>
                    <Table.Cell>
                      {(cost.includeTax ? parseFloat(cost.amount || 0) * 0.05 : 0).toFixed(2)}
                      <Button
                        icon="trash"
                        negative
                        size="mini"
                        floated="right"
                        onClick={() => removeOtherCost(index)}
                      />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>

              <Table.Footer>
                <Table.Row>
                  <Table.HeaderCell colSpan="4">
                    <Button
                      icon="plus"
                      content="新增其他成本項目"
                      basic
                      fluid
                      onClick={addOtherCost}
                    />
                  </Table.HeaderCell>
                </Table.Row>
                <Table.Row>
                  <Table.HeaderCell colSpan="2" textAlign="right">
                    成本 TTL:
                  </Table.HeaderCell>
                  <Table.HeaderCell colSpan="2" positive>
                    {totals.totalCost} 元
                  </Table.HeaderCell>
                </Table.Row>
                <Table.Row>
                  <Table.HeaderCell colSpan="2" textAlign="right">
                    (成本/營業額)%:
                  </Table.HeaderCell>
                  <Table.HeaderCell colSpan="2" positive>
                    {totals.costRate}%
                  </Table.HeaderCell>
                </Table.Row>
              </Table.Footer>
            </CalculationTable>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => {
            setIsModalOpen(false);
            setIsEditMode(false);
            setEditingId(null);
            resetForm();
          }}>
            取消
          </Button>
          <Button positive onClick={isEditMode ? handleUpdate : handleSave}>
            {isEditMode ? '更新' : '保存'}
          </Button>
        </Modal.Actions>
      </Modal>

      {/* 刪除確認 Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        size="mini"
      >
        <Modal.Header>確認刪除</Modal.Header>
        <Modal.Content>
          <p>確定要刪除這個成本率計算嗎？此操作無法復原。</p>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setShowDeleteConfirm(false)}>
            取消
          </Button>
          <Button positive onClick={confirmDelete}>
            確認刪除
          </Button>
        </Modal.Actions>
      </Modal>
    </StyledContainer>
  );
}

export default OrderCostRatePage