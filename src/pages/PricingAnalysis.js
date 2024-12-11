import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Input, Message, Loader, Dimmer, Button, Modal, Form, Label } from 'semantic-ui-react';
import firebase from '../utils/firebase';
import DataTable from 'react-data-table-component';
import styled from 'styled-components';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';

// Styled Components
const Container = styled.div`
  padding: 1rem;
  min-height: 100vh;
  position: relative;
`;

const Title = styled.h2`
  color: #333;
  margin-bottom: 1rem;
`;

const TopControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const SearchContainer = styled.div`
  flex: 1;
  max-width: 300px;
`;

const StyledSearchInput = styled(Input)`
  input {
    height: 40px !important;
    border-radius: 4px !important;
    &::placeholder {
      color: #999;
    }
  }
`;

const ButtonContainer = styled.div`
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const ClearButton = styled(Button)`
  margin-left: auto !important;
`;

const SchemeName = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background: #f0f8ff;
  border-radius: 4px;
  border: 1px solid #b3d9ff;
`;

const DealerPricingCalculator = () => {
  // State declarations
  const [bomTables, setBomTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNote, setSaveNote] = useState('');
  const [user, setUser] = useState(null);
  const [currentSchemeName, setCurrentSchemeName] = useState('');
  const [currentSchemeNote, setCurrentSchemeNote] = useState('');
  const [currentSchemeId, setCurrentSchemeId] = useState('');
  const [shouldFetchOriginalData, setShouldFetchOriginalData] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const navigate = useNavigate();

  // Helper functions
  const calculatePrice = useCallback((cost, margin, logisticsCostRate = 0) => {
    if (!cost || margin === '' || margin === undefined) return '';
    const logisticsCostRateDecimal = parseFloat(logisticsCostRate) / 100 || 0;
    // 使用目標毛利率加上物流成本率來計算最終價格
    return (cost / (1 - (margin / 100) - logisticsCostRateDecimal)).toFixed(2);
  }, []);
  
  const calculateMargin = useCallback((price, cost) => {
    if (!price || !cost) return '';
    // 計算毛利率時不考慮物流成本率
    return (((price - cost) / price) * 100).toFixed(2);
  }, []);
  // Authentication effect
  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load saved data effect
  useEffect(() => {
    const savedData = localStorage.getItem('currentPricingData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.pricingData && parsedData.pricingData.length > 0) {
          setBomTables(parsedData.pricingData.map(item => ({
            ...item,
            totalCost: parseFloat(item.totalCost || 0),
            totalCostWithLogistics: item.totalCostWithLogistics || '0.00',
            dealerPrice: item.dealerPrice || '',
            specialPrice: item.specialPrice || '',
            bottomPrice: item.bottomPrice || '',
            dealerMargin: item.dealerMargin || '',
            specialMargin: item.specialMargin || '',
            bottomMargin: item.bottomMargin || '',
            logisticsCostRate: item.logisticsCostRate || ''
          })));
          setCurrentSchemeName(parsedData.name);
          setCurrentSchemeNote(parsedData.note);
          setCurrentSchemeId(parsedData.id);
          setShouldFetchOriginalData(false);
        }
        localStorage.removeItem('currentPricingData');
      } catch (error) {
        console.error('Error parsing saved data:', error);
        toast.error('載入報價方案時發生錯誤');
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // Fetch BOM tables
  const fetchBomTables = useCallback(async () => {
    if (!user || !shouldFetchOriginalData) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const snapshot = await firebase.firestore().collection('bom_tables').get();
      const bomTablesData = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        const items = await Promise.all(data.items.map(async item => {
          if (item.isShared) {
            if (item.unitCost instanceof firebase.firestore.DocumentReference) {
              const unitCostDoc = await item.unitCost.get();
              item.unitCost = unitCostDoc.data()?.unitCost || 0;
            }
            if (item.name instanceof firebase.firestore.DocumentReference) {
              const nameDoc = await item.name.get();
              item.name = nameDoc.data()?.name || '未知';
            }
          }
          return item;
        }));
        
        const totalCost = items.reduce((sum, item) => {
          const itemCost = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
          const tax = item.isTaxed ? itemCost * 0.05 : 0;
          return sum + itemCost + tax;
        }, 0);

        let category = '未分類';
        if (data.category instanceof firebase.firestore.DocumentReference) {
          const categoryDoc = await data.category.get();
          category = categoryDoc.exists ? categoryDoc.data().name : '未分類';
        } else if (typeof data.category === 'string') {
          category = data.category;
        }

        const logisticsCostRate = data.logisticsCostRate || '';
        const logisticsCost = logisticsCostRate ? totalCost * (parseFloat(logisticsCostRate) / 100) : 0;
        const totalCostWithLogistics = totalCost + logisticsCost;

        return {
          id: doc.id,
          tableName: data.tableName || '未命名表格',
          totalCost,
          totalCostWithLogistics: totalCostWithLogistics.toFixed(2),
          category,
          websitePrice: data.websitePrice || '',
          logisticsCostRate: data.logisticsCostRate || '',
          dealerMargin: data.dealerMargin || '',
          specialMargin: data.specialMargin || '',
          bottomMargin: data.bottomMargin || '',
          dealerPrice: data.dealerPrice || '',
          specialPrice: data.specialPrice || '',
          bottomPrice: data.bottomPrice || ''
        };
      }));

      const sortedBomTablesData = bomTablesData.sort((a, b) => 
        a.category.localeCompare(b.category, 'zh-TW')
      );

      setBomTables(sortedBomTablesData);
    } catch (error) {
      console.error("獲取 BOM 表格時出錯:", error);
      setError("無法獲取數據。請稍後再試。");
      toast.error("獲取數據失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }, [user, shouldFetchOriginalData]);
  // Effect to fetch BOM tables
  useEffect(() => {
    if (shouldFetchOriginalData) {
      fetchBomTables();
    }
  }, [fetchBomTables, shouldFetchOriginalData]);

  // Handle value changes
  const handleValueChange = useCallback((id, field, value) => {
    setBomTables(prevTables => {
      return prevTables.map(table => {
        if (table.id !== id) return table;
        
        const newTable = { ...table };
        const numValue = parseFloat(value);
        const cost = parseFloat(table.totalCost);
  
        if (field === 'logisticsCostRate') {
          newTable.logisticsCostRate = value;
          // 改變物流成本率時，保持毛利率不變，重新計算價格
          if (table.dealerMargin) {
            newTable.dealerPrice = calculatePrice(
              cost, 
              table.dealerMargin, 
              value
            );
          }
          if (table.specialMargin) {
            newTable.specialPrice = calculatePrice(
              cost, 
              table.specialMargin, 
              value
            );
          }
          if (table.bottomMargin) {
            newTable.bottomPrice = calculatePrice(
              cost, 
              table.bottomMargin, 
              value
            );
          }
          return newTable;
        }
  
        switch (field) {
          case 'dealerPrice':
          case 'specialPrice':
          case 'bottomPrice':
            newTable[field] = value;
            if (numValue) {
              const marginField = field.replace('Price', 'Margin');
              // 計算毛利率時不考慮物流成本率
              newTable[marginField] = calculateMargin(numValue, cost);
            }
            break;
  
          case 'dealerMargin':
          case 'specialMargin':
          case 'bottomMargin':
            newTable[field] = value;
            if (numValue !== '') {
              const priceField = field.replace('Margin', 'Price');
              // 計算價格時考慮物流成本率
              newTable[priceField] = calculatePrice(
                cost,
                numValue,
                table.logisticsCostRate
              );
            }
            break;
  
          default:
            break;
        }
  
        return newTable;
      });
    });
  }, [calculatePrice, calculateMargin]);

  // Handle default save
  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = firebase.firestore().batch();
      bomTables.forEach(table => {
        const ref = firebase.firestore().collection('bom_tables').doc(table.id);
        const updateData = {
          dealerMargin: table.dealerMargin || null,
          specialMargin: table.specialMargin || null,
          bottomMargin: table.bottomMargin || null,
          dealerPrice: table.dealerPrice || null,
          specialPrice: table.specialPrice || null,
          bottomPrice: table.bottomPrice || null,
          logisticsCostRate: table.logisticsCostRate || null,
          websitePrice: table.websitePrice || null
        };
        batch.update(ref, updateData);
      });
  
      await batch.commit();
      toast.success('預設值已成功保存');
    } catch (error) {
      console.error("保存預設值時出錯:", error);
      toast.error("保存預設值失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  // Handle save applied scheme
  const handleSaveApplied = async () => {
    if (!currentSchemeId) {
      toast.error('找不到原始方案資料');
      return;
    }
  
    setSaving(true);
    try {
      const docRef = firebase.firestore().collection('pricingHistory').doc(currentSchemeId);
      
      // 檢查文檔是否存在
      const docSnapshot = await docRef.get();
      if (!docSnapshot.exists) {
        toast.error('找不到原始方案資料');
        return;
      }
  
      // 只更新方案資料，不更新 BOM 表
      const updatedData = {
        pricingData: bomTables.map(table => ({
          id: table.id,
          tableName: table.tableName,
          category: table.category,
          totalCost: table.totalCost,
          totalCostWithLogistics: table.totalCostWithLogistics,
          dealerPrice: table.dealerPrice || null,
          specialPrice: table.specialPrice || null,
          bottomPrice: table.bottomPrice || null,
          dealerMargin: table.dealerMargin || null,
          specialMargin: table.specialMargin || null,
          bottomMargin: table.bottomMargin || null,
          logisticsCostRate: table.logisticsCostRate || null
        })),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        }
      };
  
      await docRef.update(updatedData);
      toast.success('報價方案更新成功');
    } catch (error) {
      console.error('保存套用資料時出錯:', error);
      toast.error('保存套用資料失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };
  // Handle save new scheme
  const handleSaveClick = () => {
    setIsSaveModalOpen(true);
    setSaveName(`報價方案 ${new Date().toLocaleDateString()}`);
  };

  const handleSaveConfirm = async () => {
    if (!saveName.trim()) {
      toast.error('請輸入報價名稱');
      return;
    }
  
    try {
      const saveData = {
        name: saveName.trim(),
        note: saveNote.trim(),
        pricingData: bomTables.map(table => ({
          id: table.id,
          tableName: table.tableName,
          category: table.category,
          totalCost: table.totalCost,
          totalCostWithLogistics: table.totalCostWithLogistics,
          websitePrice: table.websitePrice || null,
          dealerPrice: table.dealerPrice || null,
          specialPrice: table.specialPrice || null,
          bottomPrice: table.bottomPrice || null,
          dealerMargin: table.dealerMargin || null,
          specialMargin: table.specialMargin || null,
          bottomMargin: table.bottomMargin || null,
          logisticsCostRate: table.logisticsCostRate || null
        })),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
  
      await firebase.firestore()
        .collection('pricingHistory')
        .add(saveData);
  
      toast.success('報價方案已成功儲存');
      setIsSaveModalOpen(false);
      setSaveName('');
      setSaveNote('');
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast.error('儲存報價資料時發生錯誤');
    }
  };

  // Handle close scheme
  const handleCloseScheme = useCallback(() => {
    setCurrentSchemeName('');
    setCurrentSchemeNote('');
    setCurrentSchemeId('');
    setShouldFetchOriginalData(true);
  }, []);

  // Filtered data based on search
  const filteredBomTables = useMemo(() => {
    return bomTables.filter(table => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        table.category.toLowerCase().includes(searchTermLower) ||
        table.tableName.toLowerCase().includes(searchTermLower)
      );
    });
  }, [bomTables, searchTerm]);

  const handleClearValues = useCallback(() => {
    setBomTables(prevTables => {
      return prevTables.map(table => ({
        ...table,
        dealerPrice: '',
        specialPrice: '',
        bottomPrice: '',
        dealerMargin: '',
        specialMargin: '',
        bottomMargin: '',
        logisticsCostRate: ''
      }));
    });
    toast.success('已清除所有輸入值');
  }, []);
  
  const handleClearClick = () => {
    setShowClearConfirm(true);
  };
  
  const handleClearConfirm = () => {
    handleClearValues();
    setShowClearConfirm(false);
  };

  // DataTable columns configuration
  const columns = [
    {
      name: '類別',
      selector: row => row.category,
      sortable: true,
      width: '11%'
    },
    {
      name: '商品名稱',
      selector: row => row.tableName,
      sortable: true,
      width: '13%'
    },
    {
        name: '官網價格',
        cell: row => (
            <div style={{ 
                color: row.websitePriceChanged ? '#ff0000' : 'inherit'
            }}>
                {currentSchemeName ? 
                    // 歷史報價檢視
                    <>
                        {row.oldWebsitePrice ? `$${row.oldWebsitePrice}` : '-'}
                        {row.websitePriceChanged && (
                            <span style={{ marginLeft: '4px', fontSize: '1.15em' }}>
                                (現為 ${row.websitePrice})
                            </span>
                        )}
                    </> :
                    // 標準報價檢視
                    `$${row.websitePrice || '-'}`
                }
            </div>
        ),
        sortable: true,
        width: '10%'
    },
    {
        name: '成本',
        cell: row => (
            <div style={{ color: row.costChanged ? '#ff0000' : 'inherit' }}>
                {currentSchemeName ?
                    // 歷史報價檢視
                    <>
                        {row.oldTotalCost ? `$${row.oldTotalCost.toFixed(2)}` : '-'}
                        {row.costChanged && (
                            <span style={{ marginLeft: '4px', fontSize: '1.15em' }}>
                                (現為 ${row.totalCost.toFixed(2)})
                            </span>
                        )}
                    </> :
                    // 標準報價檢視
                    `$${row.totalCost.toFixed(2)}`
                }
            </div>
        ),
        sortable: true,
        width: '10%'
    },
    {
      name: '經銷價',
      cell: row => (
        <Input
          type="number"
          value={row.dealerPrice}
          onChange={(e) => handleValueChange(row.id, 'dealerPrice', e.target.value)}
          placeholder="輸入金額"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    },
    {
      name: '經銷毛利率(%)',
      cell: row => (
        <Input
          type="number"
          value={row.dealerMargin}
          onChange={(e) => handleValueChange(row.id, 'dealerMargin', e.target.value)}
          placeholder="%"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    },
    {
      name: '特價',
      cell: row => (
        <Input
          type="number"
          value={row.specialPrice}
          onChange={(e) => handleValueChange(row.id, 'specialPrice', e.target.value)}
          placeholder="輸入金額"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    },
    {
      name: '特價毛利率(%)',
      cell: row => (
        <Input
          type="number"
          value={row.specialMargin}
          onChange={(e) => handleValueChange(row.id, 'specialMargin', e.target.value)}
          placeholder="%"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    },
    {
      name: '底價',
      cell: row => (
        <Input
          type="number"
          value={row.bottomPrice}
          onChange={(e) => handleValueChange(row.id, 'bottomPrice', e.target.value)}
          placeholder="輸入金額"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    },
    {
      name: '底價毛利率(%)',
      cell: row => (
        <Input
          type="number"
          value={row.bottomMargin}
          onChange={(e) => handleValueChange(row.id, 'bottomMargin', e.target.value)}
          placeholder="%"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    },
    {
      name: '訂單物流成本率(%)',
      cell: row => (
        <Input
          type="number"
          value={row.logisticsCostRate}
          onChange={(e) => handleValueChange(row.id, 'logisticsCostRate', e.target.value)}
          placeholder="%"
          style={{ width: '75%' }}
        />
      ),
      width: '8%'
    }
  ];

  // DataTable custom styles
  const customStyles = {
    table: {
      style: {
        backgroundColor: 'white',
      },
    },
    rows: {
      style: {
        minHeight: '72px',
      },
      stripedStyle: {
        backgroundColor: '#f8f8f8',
      },
    },
    headRow: {
      style: {
        backgroundColor: '#f0f0f0',
        borderBottomWidth: '1px',
        borderBottomColor: '#DDDDDD',
        borderBottomStyle: 'solid',
      },
    },
    headCells: {
      style: {
        paddingLeft: '8px',
        paddingRight: '8px',
        fontWeight: 'bold',
      },
    },
    cells: {
      style: {
        paddingLeft: '8px',
        paddingRight: '8px',
      },
    },
  };

  // Render loading state
  if (loading) {
    return (
      <Container>
        <Dimmer active inverted>
          <Loader size="large">報價載入中...</Loader>
        </Dimmer>
      </Container>
    );
  }

  // Render error state
  if (error) {
    return (
      <Container>
        <Message negative>{error}</Message>
      </Container>
    );
  }

  // Render unauthorized state
  if (!user) {
    return (
      <Container>
        <Message error>
          <Message.Header>需要登入</Message.Header>
          <p>您需要登入才能查看此頁面。請 <Button color="red" as={Link} to="/signin">登入</Button></p>
        </Message>
      </Container>
    );
  }

  // Main render
  return (
    <Container>
      <Toaster position="top-center" reverseOrder={false} />
      <Title>經銷報價計算</Title>

      <SchemeName>
        <div>
            {currentSchemeName ? (
            <>
                <Label color='blue' size='large'>
                當前方案：{currentSchemeName}
                </Label>
                {currentSchemeNote && (
                <Label basic size='large' style={{ marginLeft: '1rem' }}>
                    備註：{currentSchemeNote}
                </Label>
                )}
            </>
            ) : (
            <Label color='grey' size='large'>
                目前正在修改標準報價
            </Label>
            )}
        </div>
      </SchemeName>

      <ActionButtons>
        <Button 
            as={Link} 
            to="/saved-pricing"
            color="teal"
        >
            返回報價清單
        </Button>
        <Button
            as={Link}
            to="/order-cost-rate"
            color="blue"
        >
            訂單成本率計算
        </Button>
      </ActionButtons>

      <Message info>
        <Message.Header>使用說明</Message.Header>
        <p>1. 可以輸入價格或毛利率，系統會自動計算對應的值</p>
        <p>2. 請先設定每個商品的訂單物流成本率，系統會自動計算含物流成本的總成本</p>
        <p>3. 所有毛利率均基於含物流的總成本計算</p>
        <p>4. 經銷價、特價和底價都可以通過輸入價格或毛利率來設定</p>
        <p>5. 可以儲存當前報價方案，並從報價清單中載入已儲存的方案</p>
        <p>6. 若僅需儲存部分商品報價，可以先另存報價清單後進入修改清除所有值，再行填入需要的價格</p>
      </Message>
      
      <TopControls>
        <SearchContainer>
            <StyledSearchInput
            fluid
            icon='search'
            iconPosition='left'
            placeholder='搜尋商品...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            />
        </SearchContainer>
        {currentSchemeName && (
            <ClearButton
            negative
            onClick={handleClearClick}
            icon="trash alternate"
            content="清除所有輸入值"
            />
        )}
        </TopControls>

      <DataTable
        columns={columns}
        data={filteredBomTables}
        pagination
        paginationPerPage={10}
        paginationRowsPerPageOptions={[10, 25, 50, 100]}
        customStyles={customStyles}
        striped
        defaultSortFieldId={1}
        noDataComponent="沒有可顯示的數據"
      />

      <ButtonContainer>
        {currentSchemeName ? (
          <Button 
            primary 
            onClick={handleSaveApplied} 
            loading={saving}
            disabled={saving}
          >
            更新當前方案
          </Button>
        ) : (
          <>
            <Button 
              primary 
              onClick={handleSave} 
              loading={saving}
              disabled={saving}
            >
              儲存變更
            </Button>
            <Button
              color="green"
              onClick={handleSaveClick}
              disabled={saving}
            >
              另存為其他方案
            </Button>
          </>
        )}
      </ButtonContainer>

      <Modal
        open={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        size="small"
      >
        <Modal.Header>儲存報價方案</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field required>
              <label>方案名稱</label>
              <Input
                placeholder="輸入報價方案名稱"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </Form.Field>
            <Form.Field>
              <label>備註</label>
              <Input
                placeholder="輸入備註說明"
                value={saveNote}
                onChange={(e) => setSaveNote(e.target.value)}
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setIsSaveModalOpen(false)}>
            取消
          </Button>
          <Button positive onClick={handleSaveConfirm}>
            儲存
          </Button>
        </Modal.Actions>
      </Modal>

      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="mini"
        >
        <Modal.Header>確認清除</Modal.Header>
        <Modal.Content>
            <p>確定要清除所有輸入的數值嗎？此操作無法復原。</p>
        </Modal.Content>
        <Modal.Actions>
            <Button negative onClick={() => setShowClearConfirm(false)}>
            取消
            </Button>
            <Button positive onClick={handleClearConfirm}>
            確認清除
            </Button>
        </Modal.Actions>
    </Modal>
    </Container>

  );
};

export default DealerPricingCalculator;