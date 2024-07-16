import React, { useState, useEffect } from 'react';
import { Container, Header, Form, Button, Message } from "semantic-ui-react";
import { useNavigate, useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";
import "firebase/compat/firestore";
import "firebase/compat/auth";

function EditSharedMaterial() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [material, setMaterial] = useState({
        name: "",
        purchaseUnitCost: "",
        productUnit: "",
        unitCost: "",
        lastUpdated: null
    });
    const [originalMaterial, setOriginalMaterial] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            setUser(user);
            setAuthChecked(true);
            if (!user) {
                toast.error('需要登入才有權限修改共用料', {
                    position: "top-center",
                    autoClose: 500,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    onClose: () => navigate('/signin')
                });
            } else {
                fetchMaterial();
            }
        });

        return () => unsubscribe();
    }, [navigate, id]);

    useEffect(() => {
        if (material.purchaseUnitCost && material.productUnit) {
            const calculatedProductUnitCost = parseFloat(material.purchaseUnitCost) / parseFloat(material.productUnit);
            setMaterial(prev => ({
                ...prev,
                unitCost: isNaN(calculatedProductUnitCost) ? "" : calculatedProductUnitCost.toFixed(2)
            }));
        } else {
            setMaterial(prev => ({ ...prev, unitCost: "" }));
        }
    }, [material.purchaseUnitCost, material.productUnit]);

    const fetchMaterial = async () => {
        try {
            const doc = await firebase.firestore().collection('shared_materials').doc(id).get();
            if (doc.exists) {
                const data = { id: doc.id, ...doc.data() };
                setMaterial(data);
                setOriginalMaterial(data);
            } else {
                toast.error('找不到指定的共用料');
                navigate('/shared-material');
            }
            setIsFetching(false);
        } catch (error) {
            console.error("Error fetching shared material: ", error);
            toast.error('獲取共用料時發生錯誤');
            setIsFetching(false);
        }
    };

    const updateMaterial = (field, value) => {
        setMaterial({ ...material, [field]: value });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.error('需要登入才有權限修改共用料');
            return;
        }

        if (!material.name || !material.purchaseUnitCost || !material.productUnit) {
            toast.error('請填寫所有必填欄位');
            return;
        }

        setIsLoading(true);
        try {
            const updatedAt = firebase.firestore.Timestamp.now();
            const updatedBy = {
                displayName: user.email || "管理員",
                uid: user.uid,
                email: user.email
            };

            const updatedMaterial = {
                name: material.name,
                purchaseUnitCost: parseFloat(material.purchaseUnitCost),
                productUnit: parseFloat(material.productUnit),
                unitCost: parseFloat(material.unitCost),
                updatedAt: updatedAt,
                updatedBy: updatedBy,
                lastUpdated: updatedAt
            };

            // 更新現有的共用料
            await firebase.firestore().collection('shared_materials').doc(id).update(updatedMaterial);

            // 創建歷史記錄
            await firebase.firestore().collection('shared_materials_history').add({
                originalId: id,
                ...updatedMaterial,
                previousPurchaseUnitCost: originalMaterial.purchaseUnitCost,
                previousProductUnit: originalMaterial.productUnit,
                previousunitCost: originalMaterial.unitCost,
                changeType: 'update'
            });

            setIsLoading(false);
            toast.success('共用料修改成功！');
            navigate('/shared-material');
        } catch (error) {
            console.error("Error updating shared material: ", error);
            toast.error('修改共用料時發生錯誤');
            setIsLoading(false);
        }
    };

    if (!authChecked || isFetching) {
        return <Container><Message>載入中...</Message></Container>;
    }

    return (
        <Container>
            <ToastContainer />
            <Header>修改共用料</Header>
            {user ? (
                <Form onSubmit={onSubmit}>
                    <Form.Input 
                        fluid 
                        label="共用料名稱"
                        placeholder="共用料名稱" 
                        value={material.name}
                        onChange={(e) => updateMaterial('name', e.target.value)}
                        required
                    />
                    <Form.Input 
                        fluid 
                        label="進貨單位成本"
                        type="number" 
                        step="0.01"
                        placeholder="進貨單位成本" 
                        value={material.purchaseUnitCost}
                        onChange={(e) => updateMaterial('purchaseUnitCost', e.target.value)}
                        required
                    />
                    <Form.Input 
                        fluid 
                        label="成品單位"
                        type="number" 
                        step="0.1"
                        placeholder="成品單位" 
                        value={material.productUnit}
                        onChange={(e) => updateMaterial('productUnit', e.target.value)}
                        required
                    />
                    <Form.Input 
                        fluid 
                        label="成品單位成本 (自動計算)"
                        type="number" 
                        value={material.unitCost}
                        readOnly
                    />
                    {material.lastUpdated && (
                        <Form.Field>
                            <label>上次更新時間</label>
                            <p>{material.lastUpdated.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                        </Form.Field>
                    )}
                    <Form.Button 
                        loading={isLoading} 
                        primary 
                        style={{ marginTop: '1rem', marginBottom: '1rem' }}
                    >
                        更新共用料
                    </Form.Button>
                </Form>
            ) : (
                <Message error>請先登入後再修改共用料。</Message>
            )}
        </Container>
    );
}

export default EditSharedMaterial;