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
    const [material, setMaterial] = useState({ name: "", unitCost: "" });
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

        setIsLoading(true);
        const db = firebase.firestore();
        const batch = db.batch();

        try {
            // console.log("開始新增共用料和歷史記錄");

            const docRef = db.collection('shared_materials').doc();
            const timestamp = firebase.firestore.Timestamp.now();
            const newMaterial = {
                name: material.name,
                unitCost: parseFloat(material.unitCost),
                createdAt: timestamp,
                createdBy: {
                    displayName: user.email || "匿名",
                    uid: user.uid,
                    email: user.email
                }
            };

            // 新增共用料
            batch.set(docRef, newMaterial);
            // console.log("共用料準備新增:", newMaterial);

            // 新增歷史記錄
            const historyRef = db.collection('shared_materials_history').doc();
            const historyData = {
                originalId: docRef.id,
                name: newMaterial.name,
                unitCost: newMaterial.unitCost,
                updatedAt: timestamp,
                updatedBy: newMaterial.createdBy,
                changeType: 'create'
            };
            batch.set(historyRef, historyData);
            // console.log("歷史記錄準備新增:", historyData);

            // 執行批次寫入
            await batch.commit();
            // console.log("批次寫入成功完成");

            setIsLoading(false);
            toast.success('共用料新增成功！');
            navigate('/shared-material');
        } catch (error) {
            // console.error("Error adding shared material and history: ", error);
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
                    />
                    <Form.Input 
                        fluid 
                        label="單位成本"
                        type="number" 
                        placeholder="單位成本" 
                        value={material.unitCost}
                        onChange={(e) => updateMaterial('unitCost', e.target.value)}
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