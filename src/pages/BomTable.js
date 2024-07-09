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

      // Fetch referenced unitCost for shared materials
      const items = await Promise.all(data.items.map(async item => {
        if (item.isShared && item.unitCost instanceof firebase.firestore.DocumentReference) {
          const unitCostDoc = await item.unitCost.get();
          return {
            ...item,
            unitCost: unitCostDoc.data().unitCost, // Assuming the referenced document has a `unitCost` field
          };
        }
        return item;
      }));

      // Calculate total cost in frontend
      const totalCost = items.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0);
      }, 0);

      return { id, ...data, items, totalCost: totalCost.toFixed(2) };
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
    return timeB - timeA; // Changed to sort from newest to oldest
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
      },
      {
        name: '數量',
        selector: row => row.quantity,
        sortable: true,
      },
      {
        name: '單位成本',
        selector: row => parseFloat(row.unitCost).toFixed(2),
        sortable: true,
      },
      {
        name: '小計',
        selector: row => (parseFloat(row.quantity) * parseFloat(row.unitCost)).toFixed(2),
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
          <h2>
            <Image src={bomTable.imageUrl || 'https://react.semantic-ui.com/images/wireframe/image.png'} size="small" style={{ marginBottom: '1em' }} />
            {bomTable.tableName}
          </h2>
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
        <p style={{ marginTop: '1em', fontWeight: 'bold' }}>總成本: {bomTable.totalCost}</p>
        <p style={{ marginTop: '1em', fontWeight: 'bold' }}>表格建立日期 / 時間: <span style={{ color: 'gray' }}>{new Date(bomTable.createdAt.seconds * 1000 + bomTable.createdAt.nanoseconds / 1000000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></p>
        {bomTable.updatedAt && (
          <p style={{ marginTop: '0.5em', fontWeight: 'bold' }}>上次更新時間: <span style={{ color: 'gray' }}>{new Date(bomTable.updatedAt.seconds * 1000 + bomTable.updatedAt.nanoseconds / 1000000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></p>
        )}
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