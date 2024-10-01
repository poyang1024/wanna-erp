import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Header, Form, Button, Table, Message, Image, Icon, Dropdown } from "semantic-ui-react";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";

function EditBomTable() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bomTable, setBomTable] = useState(null);
  const [tableName, setTableName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [sharedMaterials, setSharedMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [updateTime, setUpdateTime] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch BOM table
        const doc = await firebase.firestore().collection('bom_tables').doc(id).get();
        if (doc.exists) {
          const data = doc.data();
          setBomTable(data);
          setTableName(data.tableName);
          setProductCode(data.productCode || '');
          setBarcode(data.barcode || '');
          setImageUrl(data.imageUrl || '');
          setUpdateTime(data.updatedAt ? data.updatedAt.toDate() : null);

          // Handle category (could be string or reference)
          if (data.category) {
            if (typeof data.category === 'string') {
              setSelectedCategory(data.category);
            } else {
              setSelectedCategory(data.category.id);
            }
          }

          // Fetch shared materials
          const sharedMaterialsSnapshot = await firebase.firestore().collection('shared_materials').get();
          const sharedMaterialsData = sharedMaterialsSnapshot.docs.map((doc) => ({
            key: doc.id,
            text: doc.data().name,
            value: doc.id,
            unitCost: doc.data().unitCost
          }));
          setSharedMaterials(sharedMaterialsData);

          // Process items
          const processedItems = await Promise.all(data.items.map(async (item) => {
            if (item.isShared) {
              const sharedMaterialDoc = await item.unitCost.get();
              const sharedMaterialData = sharedMaterialDoc.data();
              return {
                ...item,
                name: sharedMaterialDoc.id,
                unitCost: sharedMaterialData.unitCost,
                materialRef: sharedMaterialDoc.id
              };
            }
            return item;
          }));
          setItems(processedItems);
        } else {
          toast.error('找不到指定的 BOM 表');
          navigate('/');
        }

        // Fetch categories
        const categoriesSnapshot = await firebase.firestore().collection('categorys').get();
        const categoriesData = categoriesSnapshot.docs.map((doc) => ({
          key: doc.id,
          text: doc.data().name,
          value: doc.id
        }));
        setCategories(categoriesData);

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data: ", error);
        toast.error('獲取數據時發生錯誤');
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field === 'isShared') {
      newItems[index].name = "";
      newItems[index].unitCost = "";
      newItems[index].materialRef = null;
    } else if (field === 'name' && newItems[index].isShared) {
      const selectedMaterial = sharedMaterials.find(m => m.value === value);
      if (selectedMaterial) {
        newItems[index].unitCost = selectedMaterial.unitCost;
        newItems[index].materialRef = selectedMaterial.key;
      }
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: "", quantity: "", unitCost: "", isShared: false, materialRef: null, isTaxed: false }]);
  };

  const deleteItem = (index) => {
    setItems(prevItems => prevItems.filter((_, i) => i !== index));
  };

  const totalCost = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.unitCost) || 0;
      const itemCost = quantity * unitCost;
      const tax = item.isTaxed ? itemCost * 0.05 : 0;
      return sum + itemCost + tax;
    }, 0);
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let updatedImageUrl = imageUrl;

      if (file) {
        const fileRef = firebase.storage().ref('bom-images/' + id);
        const snapshot = await fileRef.put(file);
        updatedImageUrl = await snapshot.ref.getDownloadURL();
      }

      const currentUser = firebase.auth().currentUser;

      // 處理項目，區分共用料和非共用料
      const processedItems = items.filter(item => item.name && item.quantity).map(item => ({
        name: item.isShared ? firebase.firestore().doc(`shared_materials/${item.materialRef}`) : item.name,
        quantity: parseFloat(item.quantity) || 0,
        isShared: item.isShared,
        unitCost: item.isShared
          ? firebase.firestore().doc(`shared_materials/${item.materialRef}`)
          : parseFloat(item.unitCost) || 0,
        isTaxed: item.isTaxed
      }));

      const currentTimestamp = firebase.firestore.FieldValue.serverTimestamp();

      const updateData = {
        tableName,
        productCode,
        barcode,
        items: processedItems,
        category: selectedCategory ? firebase.firestore().doc(`categorys/${selectedCategory}`) : null,
        imageUrl: updatedImageUrl,
        updatedAt: currentTimestamp,
        updatedBy: {
          uid: currentUser.uid,
          displayName: currentUser.email,
          email: currentUser.email
        }
      };

      await firebase.firestore().collection('bom_tables').doc(id).set(updateData, { merge: true });

      setUpdateTime(new Date());

      toast.success('BOM 表修改成功');
      
      setTimeout(() => {
        navigate('/bom-table');
      }, 800);

    } catch (error) {
      console.error("Error updating BOM table: ", error);
      toast.error('修改 BOM 表時發生錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  const preview = file ? URL.createObjectURL(file) : (imageUrl || 'https://react.semantic-ui.com/images/wireframe/image.png');

  if (isLoading) {
    return <Container><Message>載入中...</Message></Container>;
  }

  return (
    <Container>
      <ToastContainer />
      <Header>修改 BOM 表格</Header>
      <Form onSubmit={handleSubmit}>
        <Image src={preview} size="small" floated="left" />
        <Button basic as="label" htmlFor="bom-image">
          上傳圖片
        </Button>
        <Form.Input
          type="file"
          id="bom-image"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files[0])}
        />

        <Form.Input
          fluid
          label="BOM 表格名稱"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
        />

        <Form.Input
          fluid
          label="產品料號"
          value={productCode}
          onChange={(e) => setProductCode(e.target.value)}
        />

        <Form.Input
          fluid
          label="條碼編號"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
        />

        <Form.Field>
          <label>選擇類別</label>
          <Dropdown
            placeholder='選擇類別'
            fluid
            selection
            options={categories}
            value={selectedCategory}
            onChange={(_, { value }) => setSelectedCategory(value)}
          />
        </Form.Field>

        {updateTime && (
          <Form.Field>
            <label>上次更新時間</label>
            <p>{updateTime.toLocaleString()}</p>
          </Form.Field>
        )}

        <Table celled>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>是否為共用料</Table.HeaderCell>
              <Table.HeaderCell>項目名稱</Table.HeaderCell>
              <Table.HeaderCell style={{ width: '120px' }}>數量</Table.HeaderCell>
              <Table.HeaderCell>單位成本</Table.HeaderCell>
              <Table.HeaderCell>是否含稅 (停用)</Table.HeaderCell>
              <Table.HeaderCell>稅金 (停用)</Table.HeaderCell>
              <Table.HeaderCell>小計</Table.HeaderCell>
              <Table.HeaderCell>操作</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item, index) => (
              <Table.Row key={index}>
                <Table.Cell>
                  <Form.Checkbox
                    checked={item.isShared}
                    onChange={(_, { checked }) => handleItemChange(index, 'isShared', checked)}
                  />
                </Table.Cell>
                <Table.Cell>
                  {item.isShared ? (
                    <Dropdown
                      placeholder='選擇共用料'
                      fluid
                      selection
                      options={sharedMaterials}
                      value={item.materialRef}
                      onChange={(_, { value }) => handleItemChange(index, 'name', value)}
                    />
                  ) : (
                    <Form.Input
                      fluid
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    />
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Form.Input
                    fluid
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Form.Input
                    fluid
                    type="number"
                    value={item.unitCost}
                    onChange={(e) => handleItemChange(index, 'unitCost', e.target.value)}
                    readOnly={item.isShared}
                  />
                </Table.Cell>
                <Table.Cell>
                  <Form.Checkbox
                    checked={item.isTaxed}
                    onChange={(_, { checked }) => handleItemChange(index, 'isTaxed', checked)}
                    disabled={true} // 添加此行以禁用該複選框
                  />
                </Table.Cell>
                <Table.Cell>
                  {item.isTaxed ? (parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0) * 0.05).toFixed(2) : "0.00"}
                </Table.Cell>
                <Table.Cell>
                  {((parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0)) * (item.isTaxed ? 1.05 : 1)).toFixed(2)}
                </Table.Cell>
                <Table.Cell>
                  <Button 
                    icon 
                    color="red" 
                    onClick={() => deleteItem(index)}
                    disabled={items.length === 1}
                  >
                    <Icon name="trash" />
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          <Table.Footer>
            <Table.Row>
              <Table.HeaderCell colSpan="6" textAlign="right">
                總成本 (未稅)
              </Table.HeaderCell>
              <Table.HeaderCell colSpan="2">
                {totalCost.toFixed(2)}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Footer>
        </Table>
        <Button 
          type="button" 
          onClick={addItem} 
          style={{ marginTop: '1rem', marginBottom: '1rem' }}
        >
          新增成本項目
        </Button>
        <Form.Button 
          primary 
          type="submit" 
          loading={isLoading}
          style={{ marginTop: '1rem', marginBottom: '1rem' }}
        >
          保存修改
        </Form.Button>
      </Form>
    </Container>
  );
}

export default EditBomTable;