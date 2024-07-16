import React, { useState, useEffect, useMemo } from "react";
import { Grid, Image, Message, Segment, Button } from "semantic-ui-react";
import DataTable from 'react-data-table-component';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Categorys from "../components/Categorys";
import firebase from "../utils/firebase";

function BomTables() {
  const [bomTables, setBomTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        setIsAuthenticated(true);
        fetchData();
      } else {
        setIsAuthenticated(false);
        toast.error('權限不足，請先登入', {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        navigate('/signin');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const fetchData = async () => {
    // Fetch BOM tables
    const bomTablesSnapshot = await firebase.firestore().collection("bom_tables").get();
    const bomTablesData = await Promise.all(bomTablesSnapshot.docs.map(async docSnapshot => {
      const id = docSnapshot.id;
      const data = docSnapshot.data();

      // Fetch referenced unitCost and name for shared materials
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

      // Calculate total cost in frontend, including tax
      const totalCost = items.reduce((sum, item) => {
        const itemCost = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
        const tax = item.isTaxed ? itemCost * 0.05 : 0;
        return sum + itemCost + tax;
      }, 0);

      return { id, ...data, items, totalCost: totalCost.toFixed(2),updatedByDisplayName: data.updatedBy ? data.updatedBy.displayName : '尚未更新' };
    }));
    setBomTables(bomTablesData);

    // Fetch categories
    const categoriesSnapshot = await firebase.firestore().collection("categorys").get();
    const categoriesData = categoriesSnapshot.docs.map(doc => doc.data());
    setCategories(categoriesData);
  };

  const filteredBomTables = selectedCategory
    ? bomTables.filter(table => table.category === selectedCategory)
    : bomTables;

  const sortedBomTables = filteredBomTables.sort((a, b) => {
    const timeA = a.createdAt.seconds * 1000 + a.createdAt.nanoseconds / 1000000;
    const timeB = b.createdAt.seconds * 1000 + b.createdAt.nanoseconds / 1000000;
    return timeB - timeA;
  });

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
      {
        name: '是否含稅',
        selector: row => row.isTaxed ? '是' : '否',
        sortable: true,
      },
      {
        name: '稅金',
        selector: row => row.isTaxed ? (parseFloat(row.quantity) * parseFloat(row.unitCost) * 0.05).toFixed(2) : '0.00',
        sortable: true,
      },
      {
        name: '小計 (含稅)',
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

  const renderContent = () => {
    if (!isAuthenticated) {
      return null;
    }

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
          <div>
            <Image src={bomTable.imageUrl || 'https://react.semantic-ui.com/images/wireframe/image.png'} size="small" style={{ marginBottom: '1em' }} />
            <h2>{bomTable.tableName}</h2>
            <p style={{ fontSize: '1.3em', color: 'black' }}>
            &nbsp;&nbsp;&nbsp;料號: {bomTable.productCode || '未指定'}<br />
            &nbsp;&nbsp;&nbsp;產品條碼: {bomTable.barcode || '未指定'}
            </p>
          </div>
          <Button primary onClick={() => handleEdit(bomTable.id)}>修改</Button>
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
        <p style={{ marginTop: '1em', fontWeight: 'bold' }}>總成本 (含稅): {bomTable.totalCost}</p>
        <p style={{ marginTop: '1em', fontWeight: 'bold' }}>表格建立日期 / 時間: <span style={{ color: 'gray' }}>{new Date(bomTable.createdAt.seconds * 1000 + bomTable.createdAt.nanoseconds / 1000000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></p>
        {bomTable.updatedAt && (
          <p style={{ marginTop: '0.5em', fontWeight: 'bold' }}>上次更新時間: <span style={{ color: 'gray' }}>{new Date(bomTable.updatedAt.seconds * 1000 + bomTable.updatedAt.nanoseconds / 1000000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></p>
        )}
        <p style={{ marginTop: '0.5em', fontWeight: 'bold' }}>最後更新者: <span style={{ color: 'gray' }}>{bomTable.updatedByDisplayName}</span></p>
      </Segment>
    ));
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Grid>
      <Grid.Row>
        <Grid.Column width={2}>
          <Categorys
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </Grid.Column>
        <Grid.Column width={1}>
        </Grid.Column>
        <Grid.Column width={12}>
          {renderContent()}
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
}

export default BomTables;