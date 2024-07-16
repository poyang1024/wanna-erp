import React, { useState, useEffect } from 'react';
import { Container, Header, Form, Button, Message } from "semantic-ui-react";
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";
import "firebase/compat/firestore";
import "firebase/compat/auth";

function NewSharedMaterial() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [material, setMaterial] = useState({
        name: "",
        purchaseUnitCost: "",
        productUnit: "",
        unitCost: ""
    });
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            setUser(user);
            setAuthChecked(true);
            if (!user) {
                toast.error('需要登入才有權限新增共用料', {
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

    const updateMaterial = (field, value) => {
        setMaterial({ ...material, [field]: value });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!user) {
            toast.error('需要登入才有權限新增共用料');
            navigate('/signin');
            return;
        }

        if (!material.name || !material.purchaseUnitCost || !material.productUnit) {
            toast.error('請填寫所有必填欄位');
            return;
        }

        setIsLoading(true);
        const db = firebase.firestore();
        const batch = db.batch();

        try {
            const docRef = db.collection('shared_materials').doc();
            const timestamp = firebase.firestore.Timestamp.now();
            const newMaterial = {
                name: material.name,
                purchaseUnitCost: parseFloat(material.purchaseUnitCost),
                productUnit: parseFloat(material.productUnit),
                unitCost: parseFloat(material.unitCost),
                createdAt: timestamp,
                createdBy: {
                    displayName: user.email || "匿名",
                    uid: user.uid,
                    email: user.email
                }
            };

            batch.set(docRef, newMaterial);

            const historyRef = db.collection('shared_materials_history').doc();
            const historyData = {
                originalId: docRef.id,
                ...newMaterial,
                updatedAt: timestamp,
                updatedBy: newMaterial.createdBy,
                changeType: 'create'
            };
            batch.set(historyRef, historyData);

            await batch.commit();

            setIsLoading(false);
            toast.success('共用料新增成功！');
            navigate('/shared-material');
        } catch (error) {
            toast.error(`新增共用料時發生錯誤: ${error.message}`);
            setIsLoading(false);
        }
    };

    if (!authChecked) {
        return <Container><Message>載入中...</Message></Container>;
    }

    return (
        <Container>
            <ToastContainer />
            <Header>新增共用料</Header>
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
                    <Form.Button 
                        loading={isLoading} 
                        primary 
                        style={{ marginTop: '1rem', marginBottom: '1rem' }}
                    >
                        提交共用料
                    </Form.Button>
                </Form>
            ) : (
                <Message error>請先登入後再新增共用料。</Message>
            )}
        </Container>
    );
}

export default NewSharedMaterial;