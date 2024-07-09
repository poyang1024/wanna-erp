import React, { useState, useEffect } from 'react';
import { Container, Header, Table, Message } from "semantic-ui-react";
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";
import "firebase/compat/firestore";
import "firebase/compat/auth";

function SharedMaterials() {
    const navigate = useNavigate();

    // State management
    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Check user authentication status
    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            setUser(user);
            setAuthChecked(true);
            if (!user) {
                toast.error('需要登入才能查看共用料', {
                    position: "top-center",
                    autoClose: 500,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    onClose: () => navigate('/signin')
                });
            } else {
                fetchSharedMaterials();
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // Fetch shared materials from Firebase
    const fetchSharedMaterials = async () => {
        try {
            const snapshot = await firebase.firestore().collection('shared_materials').get();
            const materialsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMaterials(materialsData);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching shared materials: ", error);
            toast.error('獲取共用料時發生錯誤');
            setIsLoading(false);
        }
    };

    if (!authChecked) {
        return <Container><Message>載入中...</Message></Container>;
    }

    return (
        <Container>
            <ToastContainer />
            <Header>查看共用料</Header>
            {user ? (
                isLoading ? (
                    <Message>載入共用料中...</Message>
                ) : (
                    <Table celled>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>名稱</Table.HeaderCell>
                                <Table.HeaderCell>單位成本</Table.HeaderCell>
                                <Table.HeaderCell>建立時間</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {materials.map((material) => (
                                <Table.Row key={material.id}>
                                    <Table.Cell>{material.name}</Table.Cell>
                                    <Table.Cell>{material.unitCost}</Table.Cell>
                                    <Table.Cell>
                                        {material.createdAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                )
            ) : (
                <Message error>請先登入後再查看共用料。</Message>
            )}
        </Container>
    );
}

export default SharedMaterials;