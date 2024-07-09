import React, { useState, useEffect } from 'react';
import { Container, Header, Form, Image, Button, Table, Icon, Dropdown, Message } from "semantic-ui-react";
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";
import "firebase/compat/storage";
import "firebase/compat/firestore";
import "firebase/compat/auth";

function NewBOMTable() {
    const navigate = useNavigate();

    // 狀態管理
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [tableName, setTableName] = useState("");
    const [items, setItems] = useState([{ name: "", quantity: "", unitCost: "", isShared: false, materialRef: null }]);
    const [isLoading, setIsLoading] = useState(false);
    const [file, setFile] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [sharedMaterials, setSharedMaterials] = useState([]);

    // 檢查用戶登入狀態
    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            setUser(user);
            setAuthChecked(true);
            if (!user) {
                toast.error('需要登入才能新增或修改 BOM 表格', {
                    position: "top-center",
                    autoClose: 500,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    onClose: () => navigate('/signin')
                });
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // 從 Firebase 獲取類別和共用料
    useEffect(() => {
        async function fetchData() {
            try {
                // 獲取類別
                const categoriesSnapshot = await firebase.firestore().collection('categorys').get();
                const categoriesData = categoriesSnapshot.docs.map((doc) => ({
                    key: doc.id,
                    text: doc.data().name,
                    value: doc.data().name
                }));
                setCategories(categoriesData);

                // 獲取共用料
                const sharedMaterialsSnapshot = await firebase.firestore().collection('shared_materials').get();
                const sharedMaterialsData = sharedMaterialsSnapshot.docs.map((doc) => ({
                    key: doc.id,
                    text: doc.data().name,
                    value: doc.data().name,
                    unitCost: doc.data().unitCost
                }));
                setSharedMaterials(sharedMaterialsData);
            } catch (error) {
                console.error('獲取數據時出錯：', error);
                toast.error('獲取數據時發生錯誤');
            }
        }

        if (user) {
            fetchData();
        }
    }, [user]);

    // 新增項目到 BOM 表格
    const addItem = () => {
        setItems([...items, { name: "", quantity: "", unitCost: "", isShared: false, materialRef: null }]);
    };

    // 更新特定項目的欄位
    const updateItem = (index, field, value) => {
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

    // 從 BOM 表格刪除指定項目
    const deleteItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    // 計算 BOM 表格的總成本
    const calculateTotalCost = () => {
        return items.reduce((total, item) => {
            const unitCost = item.isShared ? parseFloat(item.unitCost) : parseFloat(item.unitCost) || 0;
            return total + (parseFloat(item.quantity) || 0) * unitCost;
        }, 0).toFixed(2);
    };

    // 圖片預覽 URL
    const preview = file ? URL.createObjectURL(file) : 'https://react.semantic-ui.com/images/wireframe/image.png';

    // 將 BOM 表格提交到 Firebase
    const onSubmit = async () => {
        if (!user) {
            toast.error('需要登入才能新增或修改 BOM 表格', {
                position: "top-center",
                autoClose: 500,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                onClose: () => navigate('/signin') 
            });
            return;
        }

        setIsLoading(true);
        try {
            const documentRef = firebase.firestore().collection('bom_tables').doc();
            let imageUrl = null;

            if (file) {
                const fileRef = firebase.storage().ref('bom-images/' + documentRef.id);
                const snapshot = await fileRef.put(file);
                imageUrl = await snapshot.ref.getDownloadURL();
            }

            // 處理項目，區分共用料和非共用料
            const processedItems = items.map(item => ({
                name: item.name,
                quantity: parseFloat(item.quantity) || 0,
                isShared: item.isShared,
                unitCost: item.isShared
                    ? firebase.firestore().doc(`shared_materials/${item.materialRef}`)
                    : parseFloat(item.unitCost) || 0
            }));

            await documentRef.set({
                tableName,
                items: processedItems,
                category: selectedCategory,
                createdAt: firebase.firestore.Timestamp.now(),
                createdBy: {
                    displayName: firebase.auth().currentUser.displayName || "管理員",
                    uid: firebase.auth().currentUser.uid,
                    email: firebase.auth().currentUser.email
                },
                imageUrl
            });
            setIsLoading(false);
            toast.success('BOM 表格創建成功！');
            navigate('/bom-table');
        } catch (error) {
            console.error("新增 BOM 表格時出錯：", error);
            toast.error('新增 BOM 表格時發生錯誤');
            setIsLoading(false);
        }
    };

    if (!authChecked) {
        return <Container><Message>載入中...</Message></Container>;
    }

    return (
        <Container>
            <ToastContainer />
            <Header>新增 BOM 表格</Header>
            {user ? (
                <Form onSubmit={onSubmit}>
                    {/* 圖片上傳區域 */}
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

                    {/* BOM 表格名稱輸入 */}
                    <Form.Input 
                        label="BOM 表格名稱" 
                        placeholder="輸入 BOM 表格名稱" 
                        value={tableName} 
                        onChange={(e) => setTableName(e.target.value)} 
                    />

                    {/* 類別選擇下拉選單 */}
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

                    {/* BOM 表格項目列表 */}
                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>是否為共用料</Table.HeaderCell>
                                <Table.HeaderCell>項目名稱</Table.HeaderCell>
                                <Table.HeaderCell>數量</Table.HeaderCell>
                                <Table.HeaderCell>單位成本</Table.HeaderCell>
                                <Table.HeaderCell>操作</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {items.map((item, index) => (
                                <Table.Row key={index}>
                                    {/* 共用料複選框 */}
                                    <Table.Cell>
                                        <Form.Checkbox
                                            checked={item.isShared}
                                            onChange={(_, { checked }) => updateItem(index, 'isShared', checked)}
                                        />
                                    </Table.Cell>
                                    {/* 項目名稱輸入（條件渲染） */}
                                    <Table.Cell>
                                        {item.isShared ? (
                                            // 如果是共用料，顯示下拉選單
                                            <Dropdown
                                                placeholder='選擇共用料'
                                                fluid
                                                selection
                                                options={sharedMaterials}
                                                value={item.name}
                                                onChange={(_, { value }) => updateItem(index, 'name', value)}
                                            />
                                        ) : (
                                            // 如果不是共用料，顯示文字輸入
                                            <Form.Input 
                                                fluid 
                                                placeholder="項目名稱" 
                                                value={item.name}
                                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                            />
                                        )}
                                    </Table.Cell>
                                    {/* 數量輸入 */}
                                    <Table.Cell>
                                        <Form.Input 
                                            fluid 
                                            type="number" 
                                            placeholder="數量" 
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                        />
                                    </Table.Cell>
                                    {/* 單位成本輸入 */}
                                    <Table.Cell>
                                        <Form.Input 
                                            fluid 
                                            type="number" 
                                            placeholder="單位成本" 
                                            value={item.unitCost}
                                            onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
                                            readOnly={item.isShared}
                                        />
                                    </Table.Cell>
                                    {/* 刪除項目按鈕 */}
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
                        {/* 總成本顯示 */}
                        <Table.Footer>
                            <Table.Row>
                                <Table.HeaderCell colSpan="4">總成本</Table.HeaderCell>
                                <Table.HeaderCell>{calculateTotalCost()}</Table.HeaderCell>
                            </Table.Row>
                        </Table.Footer>
                    </Table>
                    {/* 新增項目按鈕 */}
                    <Button 
                        type="button" 
                        onClick={addItem} 
                        style={{ marginTop: '1rem', marginBottom: '1rem' }}
                    >
                        新增項目
                    </Button>
                    {/* 提交 BOM 表格按鈕 */}
                    <Form.Button 
                        loading={isLoading} 
                        primary 
                        style={{ marginTop: '1rem', marginBottom: '1rem' }}
                    >
                        提交 BOM 表格
                    </Form.Button>
                </Form>
            ) : (
                <Message error>請登入以創建 BOM 表格。</Message>
            )}
        </Container>
    );
}

export default NewBOMTable;