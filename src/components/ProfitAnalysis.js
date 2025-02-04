import React, { useState, useEffect, useCallback, useMemo } from 'react';
import firebase from '../utils/firebase';
import { Loader, Message, Input, Button, Dimmer } from 'semantic-ui-react';
import DataTable from 'react-data-table-component';
import styled from 'styled-components';
import toast, { Toaster } from 'react-hot-toast';

const Container = styled.div`
  padding: 1rem;
  min-height: 100vh;
  position: relative;
`;

const Title = styled.h2`
  color: #333;
  margin-bottom: 1rem;
`;

const SaveButton = styled(Button)`
  margin-top: 1rem;
`;

const SearchContainer = styled.div`
  margin-bottom: 1rem;
  max-width: 300px;
`;

const BOMTotalCostAnalysis = () => {
  const [bomTables, setBomTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [costOrderRate, setCostOrderRate] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCostOrderRate = useCallback(async () => {
    try {
      const snapshot = await firebase.firestore()
        .collection('excelAnalysis')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const latestAnalysis = snapshot.docs[0].data();
        const rate = latestAnalysis.stats.orderCostRate * 100;
        console.log('Fetched cost order rate:', rate);
        setCostOrderRate(rate);
      } else {
        console.log('No cost order rate data found');
      }
    } catch (error) {
      console.error("Error fetching cost order rate:", error);
      toast.error("獲取成本訂單率失敗，請稍後再試。");
    }
  }, []);

  const fetchBomTables = useCallback(async () => {
    try {
      await fetchCostOrderRate();

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

        return {
          id: doc.id,
          tableName: data.tableName || '未命名表格',
          totalCost: totalCost,
          websitePrice: data.websitePrice || '',
          category: category
        };
      }));

      const sortedBomTablesData = bomTablesData.sort((a, b) => 
        a.category.localeCompare(b.category, 'zh-TW')
      );

      console.log('Fetched BOM tables:', sortedBomTablesData);
      setBomTables(sortedBomTablesData);
    } catch (error) {
      console.error("獲取 BOM 表格時出錯:", error);
      setError("無法獲取數據。請稍後再試。");
      toast.error("獲取數據失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }, [fetchCostOrderRate]);

  useEffect(() => {
    fetchBomTables();
  }, [fetchBomTables]);

  const handleWebsitePriceChange = useCallback((id, value) => {
    setBomTables(prevTables =>
      prevTables.map(table =>
        table.id === id ? { ...table, websitePrice: value } : table
      )
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = firebase.firestore().batch();
      bomTables.forEach(table => {
        const ref = firebase.firestore().collection('bom_tables').doc(table.id);
        batch.update(ref, { websitePrice: table.websitePrice });
      });
      await batch.commit();
      toast.success('官網價格已成功保存');
    } catch (error) {
      console.error("保存價格時出錯:", error);
      toast.error("保存價格失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const calculateProfitMargin = useCallback((websitePrice, totalCost) => {
    const price = parseFloat(websitePrice);
    if (isNaN(price) || price <= 0) return '-';
    const margin = (((price / 1.05) - totalCost) / (price / 1.05)) * 100;
    return isNaN(margin) ? '-' : margin.toFixed(2);
  }, []);

  const calculateNetProfitMargin = useCallback((websitePrice, totalCost) => {
    const grossMargin = calculateProfitMargin(websitePrice, totalCost);
    if (grossMargin === '-') return '-';
    const netMargin = parseFloat(grossMargin) - costOrderRate;
    return isNaN(netMargin) ? '-' : netMargin.toFixed(2);
  }, [calculateProfitMargin, costOrderRate]);

  const filteredBomTables = useMemo(() => {
    return bomTables.filter(table => {
      const searchTermLower = searchTerm.toLowerCase();
      return (
        table.category.toLowerCase().includes(searchTermLower) ||
        table.tableName.toLowerCase().includes(searchTermLower) ||
        table.totalCost.toString().includes(searchTerm) ||
        (table.websitePrice && table.websitePrice.toString().includes(searchTerm))
      );
    });
  }, [bomTables, searchTerm]);

  const columns = [
    {
      name: '類別',
      selector: row => row.category,
      sortable: true,
    },
    {
      name: '(商品名稱) BOM 表格名稱',
      selector: row => row.tableName,
      sortable: true,
    },
    {
      name: '總成本（未稅）',
      selector: row => row.totalCost,
      sortable: true,
      format: row => `$${row.totalCost.toFixed(2)}`
    },
    {
      name: '官網價格(含稅)',
      cell: row => (
        <Input
          value={row.websitePrice}
          onChange={(e) => handleWebsitePriceChange(row.id, e.target.value)}
          placeholder="輸入價格"
        />
      ),
    },
    {
      name: '毛利率（未稅）',
      cell: row => {
        const profitMargin = calculateProfitMargin(row.websitePrice, row.totalCost);
        return profitMargin === '-' ? '-' : `${profitMargin}%`;
      },
      sortable: true,
    },
    {
      name: '毛利率 - 訂單成本率',
      cell: row => {
        const netProfitMargin = calculateNetProfitMargin(row.websitePrice, row.totalCost);
        return netProfitMargin === '-' ? '-' : `${netProfitMargin}%`;
      },
      sortable: true,
    }
  ];

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

  if (loading) {
    return (
      <Container>
        <Dimmer active inverted>
          <Loader size="large">載入中...</Loader>
        </Dimmer>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Message negative>{error}</Message>
      </Container>
    );
  }

  return (
    <Container>
      <Title>BOM 表格總成本分析</Title>
      <Message info>
        當前訂單成本率: {costOrderRate.toFixed(2)}%
      </Message>
      <SearchContainer>
        <Input
          fluid
          icon='search'
          placeholder='搜尋 BOM 表格...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchContainer>
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
      <SaveButton primary onClick={handleSave} loading={saving} disabled={saving}>
        保存官網價格
      </SaveButton>
    </Container>
  );
};

export default BOMTotalCostAnalysis;