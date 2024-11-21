import React, { useState, useEffect, useMemo } from "react";
import { Grid, Image, Message, Segment, Button, Loader, Dimmer, Tab } from "semantic-ui-react";
import DataTable from 'react-data-table-component';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Categorys from "../components/Categorys";
import CategoryManagement from "../components/CategoryManagement";
import firebase from "../utils/firebase";
// import styled from 'styled-components';

function BomTables() {
  const [bomTables, setBomTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const navigate = useNavigate();

  const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘
  const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分鐘

  // 新增的樣式組件
  // const StickyColumn = styled(Grid.Column)`
  // position: sticky !important;
  // top: 20px;
  // height: calc(100vh - 40px);
  // overflow-y: auto;
  // `;

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      setIsLoading(true);
      if (user) {
        setIsAuthenticated(true);
        fetchData();
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    // 添加定期緩存清理
    const cleanupInterval = setInterval(cleanupCache, CACHE_CLEANUP_INTERVAL);

    // 添加 Firebase 實時監聽器
    const unsubscribeBomTables = firebase.firestore().collection("bom_tables")
      .onSnapshot(snapshot => {
        if (snapshot.docChanges().length > 0) {
          setLastUpdateTime(Date.now());
        }
      });

    const unsubscribeCategories = firebase.firestore().collection("categorys")
      .onSnapshot(snapshot => {
        if (snapshot.docChanges().length > 0) {
          setLastUpdateTime(Date.now());
        }
      });

    return () => {
      unsubscribe();
      clearInterval(cleanupInterval);
      unsubscribeBomTables();
      unsubscribeCategories();
    };
  }, [navigate]);
  
  const cleanupCache = () => {
    const currentTime = Date.now();
    const cachedBomTablesTime = localStorage.getItem('cachedBomTablesTime');
    const cachedCategoriesTime = localStorage.getItem('cachedCategoriesTime');

    if (cachedBomTablesTime && currentTime - parseInt(cachedBomTablesTime) > CACHE_DURATION) {
      localStorage.removeItem('cachedBomTables');
      localStorage.removeItem('cachedBomTablesTime');
    }

    if (cachedCategoriesTime && currentTime - parseInt(cachedCategoriesTime) > CACHE_DURATION) {
      localStorage.removeItem('cachedCategories');
      localStorage.removeItem('cachedCategoriesTime');
    }
  };

  const fetchData = async () => {
    try {
      const currentTime = Date.now();
      const cachedBomTablesTime = localStorage.getItem('cachedBomTablesTime');
      const cachedCategoriesTime = localStorage.getItem('cachedCategoriesTime');

      // 檢查緩存是否仍然有效，並且沒有新的更新
      if (currentTime - lastUpdateTime < CACHE_DURATION &&
          cachedBomTablesTime && currentTime - parseInt(cachedBomTablesTime) < CACHE_DURATION &&
          cachedCategoriesTime && currentTime - parseInt(cachedCategoriesTime) < CACHE_DURATION) {
        const cachedBomTables = localStorage.getItem('cachedBomTables');
        const cachedCategories = localStorage.getItem('cachedCategories');
        if (cachedBomTables && cachedCategories) {
          setBomTables(JSON.parse(cachedBomTables));
          setCategories(JSON.parse(cachedCategories));
          setIsLoading(false);
          return;
        }
      }

      // 如果緩存無效或有新的更新，從 Firebase 獲取新數據
      await Promise.all([fetchBomTables(), fetchCategories()]);
      setLastUpdateTime(currentTime);
    } catch (error) {
      console.error("獲取數據時出錯:", error);
      toast.error('獲取數據時出錯');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBomTables = async () => {
    try {
      const bomTablesSnapshot = await firebase.firestore().collection("bom_tables").get();
      const bomTablesData = await Promise.all(bomTablesSnapshot.docs.map(async docSnapshot => {
        const id = docSnapshot.id;
        const data = docSnapshot.data();

        let category = data.category;
        if (category instanceof firebase.firestore.DocumentReference) {
          const categoryDoc = await category.get();
          category = categoryDoc.exists ? {
            id: categoryDoc.id, 
            name: categoryDoc.data().name
          } : null;
        }

        const items = await Promise.all(data.items.map(async item => {
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

        const totalCost = items.reduce((sum, item) => {
          const itemCost = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
          const tax = item.isTaxed ? itemCost * 0.05 : 0;
          return sum + itemCost + tax;
        }, 0);

        return { 
          id, 
          ...data, 
          category,
          items, 
          totalCost: totalCost.toFixed(2), 
          updatedByDisplayName: data.updatedBy ? data.updatedBy.displayName : '尚未更新',
          imageLoaded: false
        };
      }));

      setBomTables(bomTablesData);
      localStorage.setItem('cachedBomTables', JSON.stringify(bomTablesData));
      localStorage.setItem('cachedBomTablesTime', Date.now().toString());
    } catch (error) {
      console.error("獲取 BOM 表格時出錯:", error);
      toast.error('獲取 BOM 表格時出錯');
    }
  };

  const fetchCategories = async () => {
    try {
      const categoriesSnapshot = await firebase.firestore().collection("categorys").get();
      const categoriesData = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setCategories(categoriesData);
      localStorage.setItem('cachedCategories', JSON.stringify(categoriesData));
      localStorage.setItem('cachedCategoriesTime', Date.now().toString());
    } catch (error) {
      console.error("獲取類別時出錯:", error);
      toast.error('獲取類別時出錯');
    }
  };

  const handleTabChange = (e, { activeIndex }) => {
    setActiveTab(activeIndex);
    if (activeIndex === 0) {
      fetchData();
    }
  };

  const filteredBomTables = useMemo(() => {
    if (!selectedCategory) return bomTables;
    return bomTables.filter(table => {
      if (typeof table.category === 'string') {
        return table.category === selectedCategory;
      } else if (table.category && typeof table.category === 'object') {
        return table.category.id === selectedCategory || table.category.name === selectedCategory;
      }
      return false;
    });
  }, [bomTables, selectedCategory]);

  const sortedBomTables = useMemo(() => {
    return filteredBomTables.sort((a, b) => {
      const timeA = a.createdAt.seconds * 1000 + a.createdAt.nanoseconds / 1000000;
      const timeB = b.createdAt.seconds * 1000 + b.createdAt.nanoseconds / 1000000;
      return timeB - timeA;
    });
  }, [filteredBomTables]);

  const columns = useMemo(
    () => [
      {
        name: '是否為共用料',
        selector: row => row.isShared ? '是' : '否',
        sortable: true,
      },
      {
        name: '項目名稱',
        selector: row => row.name,
        sortable: true,
        width: '200px',
      },
      {
        name: '數量',
        selector: row => row.quantity,
        sortable: true,
      },
      {
        name: '成品單位成本',
        selector: row => parseFloat(row.unitCost).toFixed(2),
        sortable: true,
      },
      // {
      //   name: '是否含稅',
      //   selector: row => row.isTaxed ? '是' : '否',
      //   sortable: true,
      // },
      {
        name: '稅金(停用)',
        selector: row => row.isTaxed ? (parseFloat(row.quantity) * parseFloat(row.unitCost) * 0.05).toFixed(2) : '0.00',
        sortable: true,
      },
      {
        name: '小計',
        selector: row => {
          const subtotal = parseFloat(row.quantity) * parseFloat(row.unitCost);
          const tax = row.isTaxed ? subtotal * 0.05 : 0;
          return (subtotal + tax).toFixed(2);
        },
        sortable: true,
      },
    ],
    []
  );

  const handleEdit = (bomTableId) => {
    navigate(`/edit-bom-table/${bomTableId}`);
  };

  const handleCopy = (bomTable) => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const copyData = {
      tableName: `${bomTable.tableName} (${formattedDate} 複製)`,
      productCode: bomTable.productCode,
      barcode: bomTable.barcode,
      category: {
        id: bomTable.category.id,
        name: bomTable.category.name
      },
      items: bomTable.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        isShared: item.isShared,
        materialRef: item.isShared ? (item.materialRef || item.name) : null,
        isTaxed: item.isTaxed
      }))
    };
    
    console.log('複製 BOM 表格:', copyData);
    sessionStorage.setItem('copyBomTableData', JSON.stringify(copyData));
    
    navigate('/new-bomtable');
  };

  const handleImageLoad = (id) => {
    setBomTables(prevBomTables =>
      prevBomTables.map(bomTable =>
        bomTable.id === id ? { ...bomTable, imageLoaded: true } : bomTable
      )
    );
  };

  const handleCategoryChange = async () => {
    await fetchCategories();
    if (activeTab === 0) {
      await fetchBomTables();
    }
    setLastUpdateTime(Date.now());
  };

  const renderContent = () => {
    if (selectedCategory && sortedBomTables.length === 0) {
      return (
        <Message info>
          <Message.Header>沒有可顯示的 BOM 表</Message.Header>
          <p>當前選擇的類別沒有相關的 BOM 表。</p>
        </Message>
      );
    }

    return sortedBomTables.map(bomTable => (
      <Segment key={bomTable.id} raised>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1em' }}>
          <div style={{ position: 'relative' }}>
            <Dimmer active={!bomTable.imageLoaded} inverted>
              <Loader>Loading</Loader>
            </Dimmer>
            <Image
              src={bomTable.imageUrl || 'https://react.semantic-ui.com/images/wireframe/image.png'}
              size="small"
              style={{ marginBottom: '1em' }}
              onLoad={() => handleImageLoad(bomTable.id)}
              hidden={!bomTable.imageLoaded}
            />
            <h2>{bomTable.tableName}</h2>
            <p style={{ fontSize: '1.3em', color: 'black' }}>
              &nbsp;&nbsp;&nbsp;料號: {bomTable.productCode || '未指定'}<br />
              &nbsp;&nbsp;&nbsp;產品條碼: {bomTable.barcode || '未指定'}
            </p>
          </div>
          <div>
            <Button primary onClick={() => handleEdit(bomTable.id)}>修改</Button>
            <Button color="teal" onClick={() => handleCopy(bomTable)}>複製</Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={bomTable.items || []}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[10, 20, 30, 50]}
          highlightOnHover
          striped
          responsive
        />
        <p style={{ marginTop: '1em', fontWeight: 'bold' }}>總成本 (未稅): {bomTable.totalCost}</p>
        <p style={{ marginTop: '1em', fontWeight: 'bold' }}>表格建立日期 / 時間: <span style={{ color: 'gray' }}>{new Date(bomTable.createdAt.seconds * 1000 + bomTable.createdAt.nanoseconds / 1000000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></p>
        {bomTable.updatedAt && (
          <p style={{ marginTop: '0.5em', fontWeight: 'bold' }}>上次更新時間: <span style={{ color: 'gray' }}>{new Date(bomTable.updatedAt.seconds * 1000 + bomTable.updatedAt.nanoseconds / 1000000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></p>
        )}
        <p style={{ marginTop: '0.5em', fontWeight: 'bold' }}>最後更新者: <span style={{ color: 'gray' }}>{bomTable.updatedByDisplayName}</span></p>
      </Segment>
    ));
  };

  // 定義標籤頁
  const panes = [
    { 
      menuItem: 'BOM 表格', 
      render: () => 
        <Tab.Pane>
          <Grid>
            <Grid.Row>
              {/* <StickyColumn width={2}> */}
              <Grid.Column width={2}>
                <Categorys
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              </Grid.Column>
              {/* </StickyColumn> */}
              <Grid.Column width={1}></Grid.Column>
              <Grid.Column width={12}>
                {renderContent()}
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Tab.Pane> 
    },
    { 
      menuItem: '類別管理', 
      render: () => 
        <Tab.Pane>
          <CategoryManagement onCategoryChange={handleCategoryChange} />
        </Tab.Pane> 
    },
  ];

  if (isLoading) {
    return (
      <Dimmer active>
        <Loader>加載中...</Loader>
      </Dimmer>
    );
  }

  if (!isAuthenticated) {
    return (
      <Message error>
        <Message.Header>需要登入</Message.Header>
        <p>您需要登入才能查看此頁面。請 &nbsp;&nbsp; <Button color="red" as={Link} to="/signin">登入</Button></p>
      </Message>
    );
  }

  return (
    <Tab panes={panes} activeIndex={activeTab} onTabChange={handleTabChange} />
  );
}

export default BomTables;