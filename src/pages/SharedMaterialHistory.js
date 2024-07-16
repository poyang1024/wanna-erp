import React, { useState, useEffect } from 'react';
import { Container, Header, Table, Message } from "semantic-ui-react";
import { useNavigate, useParams } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";
import "firebase/compat/firestore";
import "firebase/compat/auth";

function SharedMaterialHistory() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [history, setHistory] = useState([]);
    const [materialName, setMaterialName] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            setUser(user);
            setAuthChecked(true);
            if (!user) {
                toast.error('需要登入才能查看歷史記錄', {
                    position: "top-center",
                    autoClose: 500,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    onClose: () => navigate('/signin')
                });
            } else {
                fetchMaterialHistory();
            }
        });

        return () => unsubscribe();
    }, [navigate, id]);

    const fetchMaterialHistory = async () => {
        try {
            // 獲取共用料的名稱
            const materialDoc = await firebase.firestore().collection('shared_materials').doc(id).get();
            if (!materialDoc.exists) {
                toast.error('找不到指定的共用料');
                navigate('/shared-material');
                return;
            }
            setMaterialName(materialDoc.data().name);

            // 獲取歷史記錄
            const snapshot = await firebase.firestore()
                .collection('shared_materials_history')
                .where('originalId', '==', id)
                .orderBy('updatedAt', 'desc')
                .get();

            const historyData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                updatedAt: doc.data().updatedAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
            }));
            setHistory(historyData);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching material history: ", error);
            if (error.code === 'failed-precondition') {
                toast.error('獲取歷史記錄時發生錯誤：需要建立索引。請聯繫系統管理員。');
            } else {
                toast.error('獲取歷史記錄時發生錯誤');
            }
            setIsLoading(false);
        }
    };

    if (!authChecked || isLoading) {
        return <Container><Message>載入中...</Message></Container>;
    }

    return (
        <Container>
            <ToastContainer />
            <Header>共用料歷史記錄: {materialName}</Header>
            {user ? (
                history.length > 0 ? (
                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>更新時間</Table.HeaderCell>
                                <Table.HeaderCell>名稱</Table.HeaderCell>
                                <Table.HeaderCell>進貨單位成本</Table.HeaderCell>
                                <Table.HeaderCell>更新者</Table.HeaderCell>
                                <Table.HeaderCell>變更類型</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>

                        <Table.Body>
                            {history.map((record) => (
                                <Table.Row key={record.id}>
                                    <Table.Cell>{record.updatedAt}</Table.Cell>
                                    <Table.Cell>{record.name}</Table.Cell>
                                    <Table.Cell>{record.purchaseUnitCost}</Table.Cell>
                                    <Table.Cell>{record.updatedBy.email}</Table.Cell>
                                    <Table.Cell>{record.changeType}</Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                ) : (
                    <Message info>此共用料尚無歷史記錄。</Message>
                )
            ) : (
                <Message error>請先登入後再查看歷史記錄。</Message>
            )}
        </Container>
    );
}

export default SharedMaterialHistory;