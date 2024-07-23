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
    const [productCode, setProductCode] = useState("");
    const [barcode, setBarcode] = useState("");
    const [items, setItems] = useState([]);
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

    // 從 Firebase 獲取類別和共用材料，初始化項目
    useEffect(() => {
        async function initializeData() {
            if (user) {
                try {
                    const categoriesSnapshot = await firebase.firestore().collection('categorys').get();
                    const categoriesData = categoriesSnapshot.docs.map((doc) => ({
                        key: doc.id,
                        text: doc.data().name,
                        value: doc.data().name
                    }));
                    setCategories(categoriesData);
    
                    const sharedMaterialsSnapshot = await firebase.firestore().collection('shared_materials').get();
                    const sharedMaterialsData = sharedMaterialsSnapshot.docs.map((doc) => ({
                        key: doc.id,
                        text: doc.data().name,
                        value: doc.id,
                        unitCost: doc.data().unitCost
                    }));
                    setSharedMaterials(sharedMaterialsData);
                    // console.log('Shared materials data:', sharedMaterialsData);

                    const copiedDataString = sessionStorage.getItem('copyBomTableData');
                    if (copiedDataString) {
                        const parsed = JSON.parse(copiedDataString);
                        // console.log('Parsed copied data:', parsed);

                        setTableName(parsed.tableName);
                        setProductCode(parsed.productCode);
                        setBarcode(parsed.barcode);
                        setSelectedCategory(parsed.category);

                        const initializedItems = parsed.items.map(item => {
                            // console.log('Processing item:', item);
                            if (item.isShared) {
                                let materialRef = item.materialRef || item.name;
                                // console.log('Material ref:', materialRef);

                                const sharedMaterial = sharedMaterialsData.find(m => 
                                    m.value === materialRef || 
                                    m.text.toLowerCase() === materialRef.toLowerCase()
                                );
                                // console.log('Found shared material:', sharedMaterial);

                                if (sharedMaterial) {
                                    return {
                                        ...item,
                                        name: sharedMaterial.text,
                                        unitCost: sharedMaterial.unitCost,
                                        materialRef: sharedMaterial.value
                                    };
                                }
                            }
                            return item;
                        });
                        
                        // console.log('Initialized items:', initializedItems);
                        setItems(initializedItems);
                        sessionStorage.removeItem('copyBomTableData');
                    } else {
                        setItems([{ 
                            name: "", 
                            quantity: "", 
                            unitCost: "", 
                            isShared: false, 
                            materialRef: null,
                            isTaxed: false
                        }]);
                    }
                } catch (error) {
                    // console.error('初始化數據時出錯：', error);
                    toast.error('初始化數據時發生錯誤');
                }
            }
        }
    
        initializeData();
    }, [user]);

    const updateItem = (index, field, value) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            const currentItem = { ...newItems[index] };
    
            if (field === 'isShared') {
                if (value) {
                    // 切換為共用料時
                    currentItem.isShared = true;
                    currentItem.materialRef = null; // 清除之前可能選擇的材料引用
                    // 保留數量和是否含稅的信息
                    // 清除名稱和單位成本，因為這些將從共用料中獲取
                    currentItem.name = "";
                    currentItem.unitCost = "";
                } else {
                    // 切換為非共用料時
                    currentItem.isShared = false;
                    currentItem.materialRef = null;
                    // 保留其他所有字段的值
                }
            } else if (field === 'materialRef' && currentItem.isShared) {
                const selectedMaterial = sharedMaterials.find(m => m.value === value);
                if (selectedMaterial) {
                    currentItem.materialRef = value;
                    currentItem.name = selectedMaterial.text;
                    currentItem.unitCost = selectedMaterial.unitCost;
                }
            } else {
                // 對於其他字段，直接更新值
                currentItem[field] = value;
            }
    
            newItems[index] = currentItem;
            return newItems;
        });
    };

    const addItem = () => {
        setItems([...items, { 
            name: "", 
            quantity: "", 
            unitCost: "", 
            isShared: false, 
            materialRef: null,
            isTaxed: false
        }]);
    };

    const deleteItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const calculateTotalCost = () => {
        return items.reduce((total, item) => {
            const unitCost = parseFloat(item.unitCost) || 0;
            const subtotal = (parseFloat(item.quantity) || 0) * unitCost;
            const tax = item.isTaxed ? subtotal * 0.05 : 0;
            return total + subtotal + tax;
        }, 0).toFixed(2);
    };

    const preview = file ? URL.createObjectURL(file) : 'https://react.semantic-ui.com/images/wireframe/image.png';

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

            const processedItems = items.map(item => {
                if (item.isShared && item.materialRef) {
                    const sharedMaterialRef = firebase.firestore().doc(`shared_materials/${item.materialRef}`);
                    return {
                        name: sharedMaterialRef,
                        quantity: parseFloat(item.quantity) || 0,
                        unitCost: sharedMaterialRef,
                        isShared: item.isShared,
                        isTaxed: item.isTaxed
                    };
                } else {
                    return {
                        name: item.name,
                        quantity: parseFloat(item.quantity) || 0,
                        unitCost: parseFloat(item.unitCost) || 0,
                        isShared: item.isShared,
                        isTaxed: item.isTaxed
                    };
                }
            });

            await documentRef.set({
                tableName,
                productCode,
                barcode,
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
                        label="BOM 表格名稱" 
                        placeholder="輸入 BOM 表格名稱" 
                        value={tableName} 
                        onChange={(e) => setTableName(e.target.value)} 
                    />

                    <Form.Input 
                        label="料號" 
                        placeholder="輸入料號" 
                        value={productCode} 
                        onChange={(e) => setProductCode(e.target.value)} 
                    />

                    <Form.Input 
                        label="產品條碼" 
                        placeholder="輸入產品條碼" 
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

                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>是否為共用料</Table.HeaderCell>
                                <Table.HeaderCell>項目名稱</Table.HeaderCell>
                                <Table.HeaderCell>數量</Table.HeaderCell>
                                <Table.HeaderCell>單位成本</Table.HeaderCell>
                                <Table.HeaderCell>是否含稅</Table.HeaderCell>
                                <Table.HeaderCell>稅金</Table.HeaderCell>
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
                                            onChange={(_, { checked }) => updateItem(index, 'isShared', checked)}
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
                                                onChange={(_, { value }) => updateItem(index, 'materialRef', value)}
                                            />
                                        ) : (
                                            <Form.Input 
                                                fluid 
                                                placeholder="項目名稱" 
                                                value={item.name}
                                                onChange={(e) => updateItem(index, 'name', e.target.value)}
                                            />
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Form.Input 
                                            fluid 
                                            type="number" 
                                            placeholder="數量" 
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                        />
                                    </Table.Cell>
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
                                    <Table.Cell>
                                        <Form.Checkbox
                                            checked={item.isTaxed}
                                            onChange={(_, { checked }) => updateItem(index, 'isTaxed', checked)}
                                        />
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.isTaxed ? ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0) * 0.05).toFixed(2) : "0.00"}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0) + (item.isTaxed ? (parseFloat(item.quantity) || 0) * (parseFloat(item.unitCost) || 0) * 0.05 : 0)).toFixed(2)}
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
                                <Table.HeaderCell colSpan="6">總成本</Table.HeaderCell>
                                <Table.HeaderCell colSpan="2">{calculateTotalCost()}</Table.HeaderCell>
                            </Table.Row>
                        </Table.Footer>
                    </Table>
                    <Button 
                        type="button" 
                        onClick={addItem} 
                        style={{ marginTop: '1rem', marginBottom: '1rem' }}
                    >
                        新增項目
                    </Button>
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