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

    // 狀態管理
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [material, setMaterial] = useState({ name: "", unitCost: "" });
    const [isLoading, setIsLoading] = useState(false);

    // 檢查用戶登入狀態
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

    // 更新共用料的特定欄位
    const updateMaterial = (field, value) => {
        setMaterial({ ...material, [field]: value });
    };

    // 提交共用料到Firebase
    const onSubmit = async (e) => {
        e.preventDefault();
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
            return;
        }

        setIsLoading(true);
        try {
            const docRef = firebase.firestore().collection('shared_materials').doc();
            await docRef.set({
                name: material.name,
                unitCost: parseFloat(material.unitCost),
                createdAt: firebase.firestore.Timestamp.now(),
                createdBy: {
                    displayName: firebase.auth().currentUser.displayName || "管理員",
                    uid: firebase.auth().currentUser.uid,
                    email: firebase.auth().currentUser.email
                }
            });

            setIsLoading(false);
            toast.success('共用料新增成功！');
            navigate('/'); // 提交成功後導航到首頁
        } catch (error) {
            console.error("Error adding shared material: ", error);
            toast.error('新增共用料時發生錯誤');
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